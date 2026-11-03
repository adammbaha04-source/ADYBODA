"""Financial and vehicle reports. Every figure comes from the same records the app already uses.

Definitions (kept identical to the existing screens):
- target: weekly target x number of weeks in the month (from the debt engine's weekly rows).
- collected: sum of driver payments recorded as income (Return records), including excess.
- income per week: collected income of each week, excluding excess (same as the vehicle screen).
- outstanding: ending debt of the month from the debt engine (never estimated).
- expenses (vehicle): service + tyres + insurance + non-debt payments (TRA, parking, fines).
  "Malipo ya Deni" is NOT an expense: it reduces debt.
- personal expenses: owner's Matumizi records (owner level, not per vehicle).
- lost target: lost days x daily target.
- profit: collected - vehicle expenses - personal expenses - lost target (same formula as the old monthly report).
"""
from datetime import date
from django.db.models import Sum
from fleet.engine import months_between, month_weeks, loss_for_month
from fleet.models import (Return, LostDays, ServiceRecord, TyreRecord, InsuranceRecord, PaymentRecord,
                          PersonalExpense, UserProfile)
from fleet.services import vehicle_debt, debt_summary, build_config

WEEK_TYPES = ("WEEKLY_DEFICIT", "WEEKLY_EXCESS", "EXCESS_PAYMENT", "NO_CHANGE")
MONTHS_SW = ["Januari", "Februari", "Machi", "Aprili", "Mei", "Juni", "Julai", "Agosti",
             "Septemba", "Oktoba", "Novemba", "Desemba"]


def _ym(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _in_month(qs, field, m):
    y, mo = int(m[:4]), int(m[5:7])
    return qs.filter(**{f"{field}__year": y, f"{field}__month": mo})


def vehicle_month(v, m, entries):
    s = debt_summary(entries, m, v)
    weeks = sum(1 for e in entries if e.month == m and e.type in WEEK_TYPES)
    target = sum((e.week_target or 0) for e in entries if e.month == m and e.type in WEEK_TYPES)
    collected = _in_month(Return.objects.filter(vehicle=v), "day", m).aggregate(t=Sum("amount"))["t"] or 0
    excess = _in_month(Return.objects.filter(vehicle=v, is_excess=True), "day", m).aggregate(t=Sum("amount"))["t"] or 0
    lost_days = sum(l.days for l in LostDays.objects.filter(vehicle=v, month=m))
    lost_map = {(l.month, l.week_number): l.days for l in v.lost_days.all()}
    lost_amount = loss_for_month(build_config(v), m, lost_map)
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
        "expenses": expenses, "weeks_in_month": weeks,
    }


def weekly_income(v, m):
    """Collected income per week of one month, excluding excess. Returns ({week_no: amount}, weeks_count)."""
    y, mo = int(m[:4]), int(m[5:7])
    weeks = month_weeks(y, mo, v.working_days_count, v.include_week5)
    out = {w.number: 0 for w in weeks}
    for r in Return.objects.filter(vehicle=v, is_excess=False):
        if r.week_number is not None:
            if r.record_month == m and r.week_number in out:
                out[r.week_number] += r.amount
        else:
            for w in weeks:
                if w.start <= r.day <= w.end:
                    out[w.number] += r.amount
                    break
    return out, len(weeks)


def report_title(start: str, end: str):
    """Heading words the old app used: Monthly / Quarterly / Yearly report."""
    months = months_between(start, end)
    y, mo = int(months[0][:4]), int(months[0][5:7])
    if len(months) == 1:
        return "Monthly Report", f"{MONTHS_SW[mo - 1]} {y}"
    if len(months) == 3 and mo in (1, 4, 7, 10):
        return "Quarterly Report", f"Q{(mo - 1) // 3 + 1} {y}"
    if len(months) == 12 and mo == 1:
        return "Yearly Report", str(y)
    return "Financial Report", f"{start} to {end}"


def build_report(owner, start: str, end: str, vehicle_id=None):
    vehicles = list(owner.vehicles.prefetch_related("driver_periods").all())
    if vehicle_id:
        vehicles = [v for v in vehicles if v.id == vehicle_id]
    months = months_between(start, end)
    single = len(months) == 1
    per_vehicle = []
    month_rows = {m: {"target": 0, "collected": 0, "excess": 0, "new_debt": 0, "debt_payments": 0,
                      "outstanding": 0, "expenses": 0, "lost_amount": 0, "lost_days": 0,
                      "service": 0, "tyres": 0, "insurance": 0, "other_payments": 0} for m in months}
    for v in vehicles:
        entries = vehicle_debt(v, end)
        tot = {k: 0 for k in ("target", "collected", "excess", "lost_days", "lost_amount", "expenses",
                              "new_debt", "debt_payments", "service", "tyres", "insurance", "other_payments")}
        last_outstanding = 0
        week_totals = {}
        week_count = 0
        for m in months:
            r = vehicle_month(v, m, entries)
            mr = month_rows[m]
            for k in ("target", "collected", "excess", "new_debt", "debt_payments", "lost_days", "lost_amount",
                      "expenses", "service", "tyres", "insurance", "other_payments"):
                mr[k] += r[k]
                tot[k] += r[k]
            mr["outstanding"] += r["outstanding"]
            last_outstanding = r["outstanding"]
            if single:
                wk, week_count = weekly_income(v, m)
                week_totals = wk
        latest = sorted(v.driver_periods.all(), key=lambda p: p.from_date)
        driver = latest[-1].driver_name if latest else ""
        weekly_target = v.daily_target * v.working_days_count
        per_vehicle.append({
            "id": v.id, "name": v.name, "type": v.vehicle_type, "driver": driver,
            "working_days": v.working_days_count, "daily_target": v.daily_target, "weekly_target": weekly_target,
            "target": tot["target"], "collected": tot["collected"], "excess": tot["excess"],
            "outstanding": last_outstanding, "new_debt": tot["new_debt"], "debt_payments": tot["debt_payments"],
            "lost_days": tot["lost_days"], "lost_amount": tot["lost_amount"],
            "service": tot["service"], "tyres": tot["tyres"], "insurance": tot["insurance"],
            "other_payments": tot["other_payments"], "expenses": tot["expenses"],
            "weeks": [{"number": n, "amount": a} for n, a in sorted(week_totals.items())] if single else [],
            "week_count": week_count if single else 0,
            "profit": tot["collected"] - tot["expenses"],
        })

    personal = {}
    personal_by_cat = {code: 0 for code, _ in PersonalExpense.CATEGORIES}
    for m in months:
        y, mo = int(m[:4]), int(m[5:7])
        qs = PersonalExpense.objects.filter(owner=owner, day__year=y, day__month=mo)
        personal[m] = qs.aggregate(t=Sum("amount"))["t"] or 0
        for row in qs.values("category").annotate(t=Sum("amount")):
            personal_by_cat[row["category"]] = personal_by_cat.get(row["category"], 0) + (row["t"] or 0)

    series = []
    for m in months:
        mr = month_rows[m]
        profit = mr["collected"] - mr["expenses"] - personal[m]
        series.append({"month": m, **mr, "personal": personal[m], "profit": profit})

    totals = {k: sum(r[k] for r in series) for k in
              ("target", "collected", "excess", "new_debt", "debt_payments", "expenses", "lost_days", "lost_amount",
               "service", "tyres", "insurance", "other_payments")}
    totals["personal"] = sum(personal.values())
    totals["outstanding"] = series[-1]["outstanding"] if series else 0
    totals["profit"] = totals["collected"] - totals["expenses"] - totals["personal"]
    # Deviation from system target: loss / system target (system target = target used + loss).
    system_target = totals["target"] + totals["lost_amount"]
    totals["system_target"] = system_target
    totals["loss_pct"] = round(totals["lost_amount"] / system_target * 100, 1) if system_target else 0
    totals["achieved_pct"] = round(totals["collected"] / totals["target"] * 100, 1) if totals["target"] else 0

    prof = UserProfile.objects.filter(user=owner).first()
    cats = [{"code": code, "label": label, "amount": personal_by_cat.get(code, 0)}
            for code, label in PersonalExpense.CATEGORIES]
    kind, subtitle = report_title(start, end)
    return {
        "from": start, "to": end, "vehicle_id": vehicle_id, "single_month": single,
        "title": kind, "subtitle": subtitle,
        "totals": totals, "series": series, "vehicles": per_vehicle,
        "personal_categories": cats,
        "business_name": (prof.business_name if prof else "") or owner.username,
        "generated": date.today().isoformat(),
    }
