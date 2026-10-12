"""Glue between Django models and the pure debt engine."""
from fleet.engine import (VehicleConfig, DriverPeriod, ReturnRecord, DebtEntry,
                          generate_entries, rebuild_chain)


def _month_of(d) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def vehicle_debt(vehicle, end_month: str):
    """Full debt chain up to end_month. Nothing is stored as history;
    it is always derived from current returns, lost days, driver periods and carry-over."""
    periods = [DriverPeriod(p.driver_name, p.from_date) for p in vehicle.driver_periods.all()]
    cfg = VehicleConfig(daily_target=vehicle.daily_target,
                        working_days_count=vehicle.working_days_count,
                        include_week5=vehicle.include_week5,
                        driver_periods=periods,
                        no_carry_months=set(vehicle.no_carry_months))
    returns = [ReturnRecord(r.day, r.amount, r.is_excess) for r in vehicle.returns.all()]
    lost = {(l.month, l.week_number): l.days for l in vehicle.lost_days.all()}
    manual = list(vehicle.manual_entries.all())
    # Only "Malipo ya Deni" payments reduce debt. TRA, parking and fines are expenses only.
    debt_payments = list(vehicle.payment_records.filter(payment_type="debt_payment"))

    earliest = [_month_of(r.day) for r in vehicle.returns.all()] + \
               [_month_of(m.day) for m in manual] + \
               [_month_of(p.day) for p in debt_payments] + [end_month]
    entries = generate_entries(cfg, returns, lost, min(earliest), end_month)

    for m in manual:
        base = dict(month=_month_of(m.day), day=m.day, notes=m.note)
        if m.kind == "MANUAL_PAYMENT":
            entries.append(DebtEntry(type="MANUAL_PAYMENT", paid_debt=m.amount, **base))
        else:  # MANUAL_DEBT or CARRY_OVER add to the balance
            entries.append(DebtEntry(type=m.kind, new_debt=m.amount, **base))
    for p in debt_payments:
        entries.append(DebtEntry(month=_month_of(p.day), day=p.day, type="MANUAL_PAYMENT",
                                 paid_debt=p.amount, notes=p.note or "Malipo ya Deni", sub=0))
    return rebuild_chain(entries, carry_over=0)


def debt_summary(entries, month: str, vehicle) -> dict:
    in_month = [e for e in entries if e.month == month]
    prior = [e for e in entries if e.month < month]
    starting = in_month[0].previous_debt if in_month else (prior[-1].remaining_debt if prior else 0)
    ending = in_month[-1].remaining_debt if in_month else starting
    return {
        "month": month,
        "starting_debt": starting,
        "debt_added": sum(e.new_debt for e in in_month),
        "payments": sum(e.paid_debt for e in in_month),
        "closed_debt": sum(e.closed_debt for e in in_month),
        "ending_debt": ending,
        "weekly_target": vehicle.daily_target * vehicle.working_days_count,
        "carry_over_on": month not in vehicle.no_carry_months,
    }


def serialize_entries(entries):
    return [{
        "id": f"{e.type}-{e.month}-{e.day.isoformat()}-{e.week_number or ''}",
        "month": e.month, "date": e.day.isoformat(), "type": e.type, "notes": e.notes,
        "previous_debt": e.previous_debt, "new_debt": e.new_debt, "paid_debt": e.paid_debt,
        "closed_debt": e.closed_debt, "remaining_debt": e.remaining_debt,
    } for e in entries]
