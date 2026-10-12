"""Financial and vehicle reports. Every figure comes from the same records the app already uses.

Definitions (kept identical to the existing screens):
- target: weekly target x number of weeks in the month (from the debt engine's weekly rows).
- collected: sum of driver payments recorded as income (Return records), including excess.
- outstanding: ending debt of the month from the debt engine (never estimated).
- expenses (vehicle): service + tyres + insurance + non-debt payments (TRA, parking, fines).
  "Malipo ya Deni" is NOT an expense: it reduces debt.
- personal expenses: owner's Matumizi records (owner level, not per vehicle).
- lost target: lost days x daily target.
- profit: collected - vehicle expenses - personal expenses - lost target (same formula as the old monthly report).
"""
from datetime import date
from django.db.models import Sum
from fleet.engine import months_between
from fleet.models import Return, LostDays, ServiceRecord, TyreRecord, InsuranceRecord, PaymentRecord, PersonalExpense
from fleet.services import vehicle_debt, debt_summary

WEEK_TYPES = ("WEEKLY_DEFICIT", "WEEKLY_EXCESS", "EXCESS_PAYMENT", "NO_CHANGE")


def _ym(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _in_month(qs, field, m):
    y, mo = int(m[:4]), int(m[5:7])
    return qs.filter(**{f"{field}__year": y, f"{field}__month": mo})


def vehicle_month(v, m, entries):
    s = debt_summary(entries, m, v)
    weeks = sum(1 for e in entries if e.month == m and e.type in WEEK_TYPES) or 4
    target = s["weekly_target"] * weeks
    collected = _in_month(Return.objects.filter(vehicle=v), "day", m).aggregate(t=Sum("amount"))["t"] or 0
    excess = _in_month(Return.objects.filter(vehicle=v, is_excess=True), "day", m).aggregate(t=Sum("amount"))["t"] or 0
    lost_days = sum(l.days for l in LostDays.objects.filter(vehicle=v, month=m))
    lost_amount = lost_days * v.daily_target
    service = sum(x.count * x.unit_price for x in _in_month(ServiceRecord.objects.filter(vehicle=v), "day", m))
    tyres = _in_month(TyreRecord.objects.filter(vehicle=v), "day", m).aggregate(t=Sum("amount"))["t"] or 0
    insurance = _in_month(InsuranceRecord.objects.filter(vehicle=v), "day", m).aggregate(t=Sum("amount"))["t"] or 0
    other_pay = _in_month(PaymentRecord.objects.filter(vehicle=v).exclude(payment_type="debt_payment"), "day", m).aggregate(t=Sum("amount"))["t"] or 0
    expenses = service + tyres + insurance + other_pay
    return {
        "target": target, "collected": collected, "excess": excess,
        "new_debt": s["debt_added"], "debt_payments": s["payments"], "outstanding": s["ending_debt"],
        "lost_days": lost_days, "lost_amount": lost_amount,
        "service": service, "tyres": tyres, "insurance": insurance, "other_payments": other_pay,
        "expenses": expenses,
    }


def build_report(owner, start: str, end: str, vehicle_id=None):
    vehicles = list(owner.vehicles.prefetch_related("driver_periods").all())
    if vehicle_id:
        vehicles = [v for v in vehicles if v.id == vehicle_id]
    months = months_between(start, end)
    per_vehicle = []
    month_rows = {m: {"target": 0, "collected": 0, "excess": 0, "new_debt": 0, "debt_payments": 0,
                      "outstanding": 0, "expenses": 0, "lost_amount": 0, "lost_days": 0} for m in months}
    for v in vehicles:
        entries = vehicle_debt(v, end)
        tot = {"target": 0, "collected": 0, "excess": 0, "lost_days": 0, "lost_amount": 0,
               "service": 0, "expenses": 0, "new_debt": 0, "debt_payments": 0}
        last_outstanding = 0
        for m in months:
            r = vehicle_month(v, m, entries)
            mr = month_rows[m]
            for k in ("target", "collected", "excess", "new_debt", "debt_payments", "lost_days", "lost_amount", "expenses"):
                mr[k] += r[k]
                tot[k] = tot.get(k, 0) + r[k]
            mr["outstanding"] += r["outstanding"]
            tot["service"] += r["service"]
            last_outstanding = r["outstanding"]
        latest = sorted(v.driver_periods.all(), key=lambda p: p.from_date)
        driver = latest[-1].driver_name if latest else ""
        per_vehicle.append({
            "id": v.id, "name": v.name, "type": v.vehicle_type, "driver": driver,
            "target": tot["target"], "collected": tot["collected"], "excess": tot["excess"],
            "outstanding": last_outstanding, "new_debt": tot["new_debt"], "debt_payments": tot["debt_payments"],
            "lost_days": tot["lost_days"], "lost_amount": tot["lost_amount"], "service": tot["service"],
            "expenses": tot["expenses"],
            "profit": tot["collected"] - tot["expenses"] - tot["lost_amount"],
        })

    personal = {}
    for m in months:
        y, mo = int(m[:4]), int(m[5:7])
        personal[m] = PersonalExpense.objects.filter(owner=owner, day__year=y, day__month=mo).aggregate(t=Sum("amount"))["t"] or 0

    series = []
    for m in months:
        mr = month_rows[m]
        profit = mr["collected"] - mr["expenses"] - personal[m] - mr["lost_amount"]
        series.append({"month": m, **mr, "personal": personal[m], "profit": profit})

    totals = {k: sum(r[k] for r in series) for k in
              ("target", "collected", "excess", "new_debt", "debt_payments", "expenses", "lost_days", "lost_amount")}
    totals["personal"] = sum(personal.values())
    totals["outstanding"] = series[-1]["outstanding"] if series else 0
    totals["profit"] = totals["collected"] - totals["expenses"] - totals["personal"] - totals["lost_amount"]
    return {"from": start, "to": end, "vehicle_id": vehicle_id, "totals": totals,
            "series": series, "vehicles": per_vehicle}
