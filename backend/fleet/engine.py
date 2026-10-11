"""Debt engine for vehicle income tracking.

Pure Python (no Django imports) so the rules can be tested in isolation.
All money is integer TZS. Debt history is COMPUTED from returns, lost days,
driver periods and carry-over settings. It is never trusted from a stored
copy, so editing or deleting income always changes the history.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, List, Optional, Sequence, Tuple

CLOSING_TYPES = ("DRIVER_HANDOVER", "MONTH_CLOSE")


@dataclass
class Week:
    number: int
    start: date
    end: date


@dataclass
class ReturnRecord:          # money paid in by the driver on a given day
    day: date
    amount: int
    is_excess: bool = False


@dataclass
class DriverPeriod:          # who was driving from this date onward
    name: str
    from_date: date


@dataclass
class VehicleConfig:
    daily_target: int
    working_days_count: int = 6          # e.g. 6 for Bajaj (Mon-Sat)
    include_week5: bool = False
    driver_periods: List[DriverPeriod] = field(default_factory=list)
    no_carry_months: set = field(default_factory=set)   # {"2026-03", ...}


@dataclass
class DebtEntry:
    month: str
    day: date                             # sort date
    type: str
    notes: str
    new_debt: int = 0
    paid_debt: int = 0
    previous_debt: int = 0
    remaining_debt: int = 0
    closed_debt: int = 0
    week_surplus: Optional[int] = None
    sub: int = 0                          # -1 handover, 0 normal, +1 month close
    week_number: Optional[int] = None


def month_weeks(year: int, month: int, working_days_count: int, include_week5: bool = False) -> List[Week]:
    """Monday-based weeks. Week 1 starts on the Monday on/before the 1st,
    or the following Monday if that Monday falls in the previous month.
    Each week spans `working_days_count` days (6 means Mon-Sat)."""
    first = date(year, month, 1)
    monday = first - timedelta(days=first.weekday())
    if monday.month != month:
        monday += timedelta(days=7)
    count = 5 if include_week5 else 4
    weeks = []
    for n in range(1, count + 1):
        start = monday + timedelta(days=7 * (n - 1))
        if n == 5 and start.month != month and not include_week5:
            break
        end = start + timedelta(days=working_days_count - 1)
        weeks.append(Week(n, start, end))
    return weeks


def driver_for(periods: Sequence[DriverPeriod], day: date) -> Optional[DriverPeriod]:
    if not periods:
        return None
    found = periods[0]
    for p in sorted(periods, key=lambda p: p.from_date):
        if p.from_date <= day:
            found = p
    return found


def months_between(start: str, end: str) -> List[str]:
    y, m = int(start[:4]), int(start[5:7])
    ey, em = int(end[:4]), int(end[5:7])
    out = []
    while (y, m) <= (ey, em):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return out


def generate_entries(cfg: VehicleConfig, returns: Sequence[ReturnRecord],
                     lost_days: Dict[Tuple[str, int], int],
                     start_month: str, end_month: str) -> List[DebtEntry]:
    """One weekly deficit entry per week from start_month to end_month.
    Months with no income count as a full deficit, as agreed."""
    out: List[DebtEntry] = []
    prev_name: Optional[str] = None
    first = True
    for m in months_between(start_month, end_month):
        y, mo = int(m[:4]), int(m[5:7])
        weeks = month_weeks(y, mo, cfg.working_days_count, cfg.include_week5)
        for w in weeks:
            period = driver_for(cfg.driver_periods, w.start)
            name = period.name if period else ""
            if not first and name != prev_name:
                out.append(DebtEntry(month=m, day=w.start, type="DRIVER_HANDOVER", sub=-1,
                                     week_number=w.number,
                                     notes=f'Dereva amebadilika kutoka "{prev_name or "hakuna"}" kwenda "{name or "hakuna"}"'))
            first = False
            prev_name = name

            income = sum(r.amount for r in returns if not r.is_excess and w.start <= r.day <= w.end)
            excess_in = sum(r.amount for r in returns if r.is_excess and w.start <= r.day <= w.end)
            lost = lost_days.get((m, w.number), 0)
            target = cfg.daily_target * max(0, cfg.working_days_count - lost)
            deficit = max(0, target - income)
            surplus = max(0, income - target) + excess_in
            if income < target:
                kind = "WEEKLY_DEFICIT"
            elif income > target:
                kind = "WEEKLY_EXCESS"
            elif excess_in > 0:
                kind = "EXCESS_PAYMENT"
            else:
                kind = "NO_CHANGE"
            out.append(DebtEntry(month=m, day=w.start, type=kind, week_number=w.number,
                                 new_debt=deficit, week_surplus=surplus, sub=0,
                                 notes=(f"Dereva: {name} - " if name else "") +
                                       f"Week {w.number}: Income {income} vs Target {target}"))
        if m in cfg.no_carry_months and weeks:
            last = weeks[-1]
            out.append(DebtEntry(month=m, day=last.start, type="MONTH_CLOSE", sub=1,
                                 notes="Carry over imezimwa: deni lililobaki limefungwa mwisho wa mwezi"))
    return out


def rebuild_chain(entries: List[DebtEntry], carry_over: int = 0) -> List[DebtEntry]:
    """Sort and run the balance through every entry. Closing entries move the
    balance to closed_debt and restart it at zero."""
    ordered = sorted(entries, key=lambda e: (e.month, e.day, e.sub))
    running = carry_over
    for e in ordered:
        e.previous_debt = running
        if e.type in CLOSING_TYPES:
            e.closed_debt = running
            e.paid_debt = 0
            e.new_debt = 0
            running = 0
            e.remaining_debt = 0
            continue
        running += e.new_debt
        if e.week_surplus is not None:
            pay = min(running, e.week_surplus)
        else:
            pay = min(running, e.paid_debt)
        e.paid_debt = pay
        running -= pay
        e.remaining_debt = running
    return ordered
