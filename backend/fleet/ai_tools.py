"""Read-only database tools for AdyBoda AI. All queries are tenant-scoped."""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from fleet.models import (Challenge, ServiceRecord, Return, PaymentRecord,
                          DriverPeriod, PersonalExpense)
from fleet.ai_permissions import visible_vehicles, can_read_owner_finances

MAX_ROWS = 100
MAX_RANGE_DAYS = 366
TANZANIA_TZ = ZoneInfo("Africa/Dar_es_Salaam")


def _tanzania_today():
    return timezone.now().astimezone(TANZANIA_TZ).date()


def _parse_range(args):
    today = _tanzania_today()
    try:
        start = date.fromisoformat(args.get("date_from", today.isoformat()))
        end = date.fromisoformat(args.get("date_to", today.isoformat()))
    except (TypeError, ValueError):
        raise ValidationError("Tarehe lazima ziwe YYYY-MM-DD.")
    if end < start:
        raise ValidationError("Tarehe ya mwisho haiwezi kuwa kabla ya tarehe ya mwanzo.")
    if (end - start).days > MAX_RANGE_DAYS:
        raise ValidationError("Kipindi kisizidi siku 366.")
    return start, end


def get_today_challenges(user, args):
    today = _tanzania_today()
    start = timezone.make_aware(datetime.combine(today, time.min), TANZANIA_TZ)
    end = start + timedelta(days=1)
    base_qs = Challenge.objects.filter(vehicle__in=visible_vehicles(user), created_at__gte=start, created_at__lt=end).select_related("vehicle", "created_by")
    total_count = base_qs.count()
    qs = base_qs[:MAX_ROWS]
    rows = [{"id": x.id, "vehicle": x.vehicle.name, "title": x.title,
             "description": x.description[:500], "status": x.status,
             "reported_by": x.created_by.username if x.created_by else "Haijulikani",
             "created_at": timezone.localtime(x.created_at, TANZANIA_TZ).isoformat()} for x in qs]
    return {"date": today.isoformat(), "count": total_count, "records_returned": len(rows), "items": rows}


def get_today_services(user, args):
    today = _tanzania_today()
    base_qs = ServiceRecord.objects.filter(vehicle__in=visible_vehicles(user), day=today).select_related("vehicle")
    total_count = base_qs.count()
    qs = base_qs[:MAX_ROWS]
    rows = [{"id": x.id, "vehicle": x.vehicle.name, "day": x.day.isoformat(),
             "item": x.tool, "quantity": x.count, "unit_price_tzs": x.unit_price,
             "total_tzs": x.count * x.unit_price, "seller": x.seller, "note": x.note}
            for x in qs]
    return {"date": today.isoformat(), "count": total_count, "records_returned": len(rows),
            "total_tzs": sum(x["total_tzs"] for x in rows), "items": rows}


def get_services(user, args):
    start, end = _parse_range(args)
    qs = ServiceRecord.objects.filter(vehicle__in=visible_vehicles(user), day__range=(start, end)).select_related("vehicle").order_by("-day", "-id")
    rows = [{"id": x.id, "vehicle": x.vehicle.name, "day": x.day.isoformat(), "item": x.tool,
             "quantity": x.count, "unit_price_tzs": x.unit_price,
             "total_tzs": x.count * x.unit_price, "seller": x.seller, "note": x.note}
            for x in qs[:MAX_ROWS]]
    total = sum(x.count * x.unit_price for x in qs)
    return {"date_from": start.isoformat(), "date_to": end.isoformat(),
            "records_returned": len(rows), "total_records": qs.count(),
            "total_service_tzs": total, "items": rows}


def get_income_summary(user, args):
    start, end = _parse_range(args)
    qs = Return.objects.filter(vehicle__in=visible_vehicles(user), day__range=(start, end)).select_related("vehicle")
    rows = [{"vehicle": x.vehicle.name, "day": x.day.isoformat(), "amount_tzs": x.amount,
             "is_excess": x.is_excess, "note": x.note} for x in qs.order_by("-day", "-id")[:MAX_ROWS]]
    return {"date_from": start.isoformat(), "date_to": end.isoformat(),
            "total_records": qs.count(), "total_collected_tzs": sum(x.amount for x in qs),
            "items": rows}


def get_payments_summary(user, args):
    start, end = _parse_range(args)
    qs = PaymentRecord.objects.filter(vehicle__in=visible_vehicles(user), day__range=(start, end)).select_related("vehicle")
    rows = [{"vehicle": x.vehicle.name, "day": x.day.isoformat(), "type": x.get_payment_type_display(),
             "amount_tzs": x.amount, "note": x.note} for x in qs.order_by("-day", "-id")[:MAX_ROWS]]
    totals = {}
    # Aggregate in Python without relying on database-specific JSON behavior.
    for x in qs.only("payment_type", "amount"):
        totals[x.payment_type] = totals.get(x.payment_type, 0) + x.amount
    return {"date_from": start.isoformat(), "date_to": end.isoformat(),
            "total_records": qs.count(), "total_paid_tzs": sum(x.amount for x in qs),
            "totals_by_type_tzs": totals, "items": rows}


def get_open_challenges(user, args):
    qs = Challenge.objects.filter(vehicle__in=visible_vehicles(user), status="open").select_related("vehicle", "created_by").order_by("-created_at")
    rows = [{"id": x.id, "vehicle": x.vehicle.name, "title": x.title,
             "description": x.description[:500], "reported_by": x.created_by.username if x.created_by else "Haijulikani",
             "created_at": timezone.localtime(x.created_at, TANZANIA_TZ).isoformat()} for x in qs[:MAX_ROWS]]
    return {"open_count": qs.count(), "items": rows}


def get_vehicle_overview(user, args):
    today = _tanzania_today()
    vehicles = visible_vehicles(user).order_by("name")
    rows = []
    for v in vehicles:
        driver = DriverPeriod.objects.filter(vehicle=v, from_date__lte=today).order_by("-from_date", "-id").first()
        rows.append({"vehicle_id": v.id, "vehicle": v.name, "type": v.vehicle_type,
                     "daily_target_tzs": v.daily_target, "working_days_per_week": v.working_days_count,
                     "current_driver": driver.driver_name if driver and driver.driver_name else "Hajapangiwa"})
    return {"vehicle_count": len(rows), "items": rows}


def get_personal_expenses(user, args):
    if not can_read_owner_finances(user):
        raise PermissionDenied("Matumizi binafsi yanaonekana kwa Owner pekee.")
    start, end = _parse_range(args)
    qs = PersonalExpense.objects.filter(owner=user, day__range=(start, end)).order_by("-day", "-id")
    all_rows = list(qs)
    total = sum(x.amount for x in all_rows)
    by_category = {}
    by_month = {}
    for x in all_rows:
        label = x.get_category_display()
        by_category[label] = by_category.get(label, 0) + x.amount
        month = x.day.strftime("%Y-%m")
        by_month[month] = by_month.get(month, 0) + x.amount
    categories = [{"category": k, "total_tzs": v,
                   "percent": round(v * 100 / total, 1) if total else 0}
                  for k, v in sorted(by_category.items(), key=lambda kv: -kv[1])]
    months = [{"month": k, "total_tzs": by_month[k]} for k in sorted(by_month)]
    rows = [{"day": x.day.isoformat(), "category": x.get_category_display(),
             "amount_tzs": x.amount, "note": x.note} for x in all_rows[:MAX_ROWS]]
    return {"date_from": start.isoformat(), "date_to": end.isoformat(),
            "total_records": len(all_rows), "total_expenses_tzs": total,
            "totals_by_category": categories, "totals_by_month": months,
            "items": rows}


TOOL_HANDLERS = {
    "get_today_challenges": get_today_challenges,
    "get_today_services": get_today_services,
    "get_services": get_services,
    "get_income_summary": get_income_summary,
    "get_payments_summary": get_payments_summary,
    "get_open_challenges": get_open_challenges,
    "get_vehicle_overview": get_vehicle_overview,
    "get_personal_expenses": get_personal_expenses,
}


def execute_tool(name, user, arguments):
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        raise ValueError("Tool haijaruhusiwa.")
    if not isinstance(arguments, dict):
        raise ValueError("Tool arguments lazima ziwe object.")
    return handler(user, arguments)
