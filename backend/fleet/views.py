import datetime as _dt
import re

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from rest_framework.views import APIView

from core.throttles import RegisterThrottle
from fleet.access import ScopedPermission, vehicles_for, role_of, membership_of
from fleet.engine import plan_month, months_between
from fleet.fees import makato_fee
from fleet.models import (
    Vehicle, WeekSetting, DriverPeriod, Return, LostDays, ManualLedgerEntry,
    PaymentRecord, ServiceRecord, TyreRecord, InsuranceRecord, PersonalExpense,
    Membership, UserProfile, Challenge,
)
from fleet.reports import build_report
from fleet.serializers import (
    VehicleSerializer, DriverPeriodSerializer, ReturnSerializer, LostDaysSerializer,
    ManualLedgerEntrySerializer, PaymentRecordSerializer, ServiceRecordSerializer,
    TyreRecordSerializer, InsuranceRecordSerializer, PersonalExpenseSerializer,
    TeamMemberSerializer, ChallengeSerializer,
)
from fleet.services import build_config, vehicle_debt, debt_summary, serialize_entries


# ---------------------------------------------------------------- helpers

MAX_AVATAR_CHARS = 200_000
THEME_VALUES = {"light", "dark"}
BG_VALUES = {"adybajaj", "ocean", "emerald", "sunset", "violet"}
MIN_PASSWORD_LEN = 6
# Picha za kawaida pekee. SVG inaweza kubeba script, kwa hiyo inakataliwa.
_SAFE_IMAGE = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$")
_MONTH = re.compile(r"^\d{4}-\d{2}$")
# Sehemu hizi ni za faragha: dereva wa sasa haoni za madereva wengine.
DRIVER_PRIVATE_FIELDS = ("email", "residence", "guarantor_name", "guarantor_phone")


def _is_safe_image(value):
    return bool(_SAFE_IMAGE.match(value))


def _parse_day(value, field):
    """A date typed on the Set Targets screen (YYYY-MM-DD). Empty means None."""
    if value in (None, ""):
        return None
    try:
        return _dt.date.fromisoformat(str(value))
    except ValueError:
        raise ValidationError({field: "Tarehe si sahihi. Tumia YYYY-MM-DD."})


def _profile(user):
    prof, _ = UserProfile.objects.get_or_create(user=user)
    return prof


def _require_owner(request):
    if role_of(request.user) != "owner":
        raise PermissionDenied("Owner pekee.")


class ConfirmMixin:
    """Driver signs a record for his own vehicle. Only the driver can confirm."""

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        if role_of(request.user) != "driver":
            raise PermissionDenied("Only the driver can confirm a record.")
        obj = self.get_object()
        obj.confirmed_at = timezone.now()
        obj.save(update_fields=["confirmed_at"])
        return Response(self.get_serializer(obj).data)


class OwnedVehicleMixin:
    """Every query is limited to vehicles the current user can see. Anyone else gets 404."""
    permission_classes = [ScopedPermission]
    manager_can_write = True

    def owned_vehicle(self, vehicle_id):
        return get_object_or_404(vehicles_for(self.request.user), pk=vehicle_id)


# ---------------------------------------------------------------- vehicles

class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer
    permission_classes = [ScopedPermission]
    # Manager may edit settings of his OWN assigned vehicles. Create and delete stay owner-only.
    manager_can_write = True

    def get_serializer_class(self):
        if self.action in ("list", "retrieve") and role_of(self.request.user) != "owner":
            return VehiclePublicSerializer
        return VehicleSerializer

    def get_queryset(self):
        return vehicles_for(self.request.user).prefetch_related("driver_periods")

    def create(self, request, *args, **kwargs):
        _require_owner(request)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        _require_owner(request)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        # Owner ya gari haiwezi kubadilishwa kupitia API, hata na manager.
        serializer.save(owner=serializer.instance.owner)

    @action(detail=False, methods=["get"], url_path="debt-summaries")
    def debt_summaries(self, request):
        month = request.query_params.get("month")
        if not month or not _MONTH.match(month):
            raise ValidationError({"month": "Use YYYY-MM."})
        out = []
        for vehicle in self.get_queryset():
            entries = vehicle_debt(vehicle, month)
            month_entries = [e for e in entries if e.month == month]
            out.append({"vehicle_id": vehicle.id,
                        "summary": debt_summary(entries, month, vehicle),
                        "entries": serialize_entries(month_entries)})
        return Response(out)

    @action(detail=True, methods=["get"])
    def debt(self, request, pk=None):
        vehicle = self.get_object()
        month = request.query_params.get("month")
        if not month or not _MONTH.match(month):
            raise ValidationError({"month": "Use YYYY-MM."})
        entries = vehicle_debt(vehicle, month)
        month_entries = [e for e in entries if e.month == month]
        return Response({"summary": debt_summary(entries, month, vehicle),
                         "entries": serialize_entries(month_entries)})

    @action(detail=True, methods=["get", "post"], url_path="week-plan")
    def week_plan(self, request, pk=None):
        """GET ?month=YYYY-MM -> wiki 1..5 za mwezi huo na target zake.
        POST {month, week_number, active_days?, target?, start_date?, end_date?, note?}."""
        vehicle = self.get_object()
        if request.method == "GET":
            month = request.query_params.get("month", "")
            if not _MONTH.match(month):
                raise ValidationError({"month": "Use YYYY-MM."})
        else:
            month = str(request.data.get("month", ""))
            if not _MONTH.match(month):
                raise ValidationError({"month": "Use YYYY-MM."})
            try:
                week = int(request.data.get("week_number"))
            except (TypeError, ValueError):
                raise ValidationError({"week_number": "Namba ya wiki si sahihi."})
            if not 1 <= week <= 5:
                raise ValidationError({"week_number": "Wiki ni 1 hadi 5."})
            has_dates = "start_date" in request.data or "end_date" in request.data
            new_start = _parse_day(request.data.get("start_date"), "start_date")
            new_end = _parse_day(request.data.get("end_date"), "end_date")
            if has_dates and (new_start is None) != (new_end is None):
                raise ValidationError({"end_date": "Weka tarehe zote mbili: ya kuanza na ya kumaliza."})
            if new_start and new_end and new_end < new_start:
                raise ValidationError({"end_date": "Tarehe ya kumaliza iwe baada ya ya kuanza."})
            ws, _ = WeekSetting.objects.get_or_create(vehicle=vehicle, month=month, week_number=week)
            if has_dates:
                ws.start_date, ws.end_date = new_start, new_end
            if "note" in request.data:
                ws.note = str(request.data.get("note") or "").strip()[:300]

            if "active_days" in request.data:
                days = request.data.get("active_days")
                if days is None:
                    ws.active_days = None
                else:
                    if (not isinstance(days, list) or not days or len(set(days)) != len(days)
                            or any(not isinstance(d, int) or not 0 <= d <= 6 for d in days)):
                        raise ValidationError({"active_days": "Siku ziwe 0 hadi 6, bila kurudia, angalau moja."})
                    ws.active_days = sorted(days)

            if "target" in request.data:
                t = request.data.get("target")
                if t in (None, ""):
                    ws.target = None
                else:
                    try:
                        t = int(t)
                    except (TypeError, ValueError):
                        raise ValidationError({"target": "Target si namba sahihi."})
                    if t <= 0:
                        raise ValidationError({"target": "Target lazima iwe kubwa kuliko 0."})
                    ws.target = t

            if ws.active_days is None and ws.target is None and ws.start_date is None and not ws.note:
                ws.delete()
            else:
                ws.save()

        cfg = build_config(vehicle)
        lost = {(l.month, l.week_number): l.days for l in vehicle.lost_days.all()}
        return Response({"month": month, "weeks": plan_month(cfg, month, lost)})

    @action(detail=True, methods=["post"])
    def carry(self, request, pk=None):
        """Turn carry-over on or off for one month."""
        vehicle = self.get_object()
        month = request.data.get("month")
        carry = bool(request.data.get("carry", True))
        if not month or not _MONTH.match(str(month)):
            raise ValidationError({"month": "Use YYYY-MM."})
        months = set(vehicle.no_carry_months)
        if carry:
            months.discard(month)
        else:
            months.add(month)
        vehicle.no_carry_months = sorted(months)
        vehicle.save(update_fields=["no_carry_months"])
        return Response({"no_carry_months": vehicle.no_carry_months})


# ---------------------------------------------------------------- drivers and records

class DriverPeriodPublicSerializer(DriverPeriodSerializer):
    """Same as DriverPeriodSerializer, but without private contact and guarantor fields."""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for field in DRIVER_PRIVATE_FIELDS:
            data.pop(field, None)
        return data


class VehiclePublicSerializer(VehicleSerializer):
    """VehicleSerializer for managers and drivers: driver_periods without private fields."""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for period in data.get("driver_periods", []):
            for field in DRIVER_PRIVATE_FIELDS:
                period.pop(field, None)
        return data


class DriverPeriodViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = DriverPeriodSerializer

    def get_serializer_class(self):
        # Reads by anyone but the owner use the redacted serializer. Writes need the full one.
        if self.action in ("list", "retrieve") and role_of(self.request.user) != "owner":
            return DriverPeriodPublicSerializer
        return DriverPeriodSerializer

    def get_queryset(self):
        return DriverPeriod.objects.filter(vehicle__in=vehicles_for(self.request.user))

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))


class ReturnViewSet(ConfirmMixin, OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = ReturnSerializer

    def get_queryset(self):
        qs = Return.objects.filter(vehicle__in=vehicles_for(self.request.user))
        v = self.request.query_params.get("vehicle")
        return qs.filter(vehicle_id=v) if v else qs

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))


class LostDaysViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = LostDaysSerializer

    def get_queryset(self):
        return LostDays.objects.filter(vehicle__in=vehicles_for(self.request.user))

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))


class ManualLedgerViewSet(ConfirmMixin, OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = ManualLedgerEntrySerializer

    def get_queryset(self):
        return ManualLedgerEntry.objects.filter(vehicle__in=vehicles_for(self.request.user))

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")),
                        created_by=self.request.user)


class _VehicleChildViewSet(ConfirmMixin, OwnedVehicleMixin, viewsets.ModelViewSet):
    """Base for records that belong to a vehicle. Filter with ?vehicle=<id>."""
    model = None

    def get_queryset(self):
        qs = self.model.objects.filter(vehicle__in=vehicles_for(self.request.user))
        v = self.request.query_params.get("vehicle")
        return qs.filter(vehicle_id=v) if v else qs

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))


class PaymentRecordViewSet(_VehicleChildViewSet):
    model = PaymentRecord
    serializer_class = PaymentRecordSerializer


class ServiceRecordViewSet(_VehicleChildViewSet):
    model = ServiceRecord
    serializer_class = ServiceRecordSerializer


class TyreRecordViewSet(_VehicleChildViewSet):
    model = TyreRecord
    serializer_class = TyreRecordSerializer


class InsuranceRecordViewSet(_VehicleChildViewSet):
    model = InsuranceRecord
    serializer_class = InsuranceRecordSerializer


# ---------------------------------------------------------------- owner-only money views

class PersonalExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = PersonalExpenseSerializer
    permission_classes = [ScopedPermission]
    manager_can_write = False

    def get_queryset(self):
        qs = PersonalExpense.objects.filter(owner=self.request.user)
        month = self.request.query_params.get("month")
        if month:
            if not _MONTH.match(month):
                raise ValidationError({"month": "Use YYYY-MM."})
            qs = qs.filter(day__year=int(month[:4]), day__month=int(month[5:7]))
        return qs

    def perform_create(self, serializer):
        data = serializer.validated_data
        amount = data.get("amount", 0)
        if data.get("category") == "makato":
            amount = makato_fee(data.get("makato_type", ""), data.get("transaction_amount") or 0)
        serializer.save(owner=self.request.user, amount=amount)


class ExpenseSummaryView(APIView):
    """Totals for the Matumizi tab: personal categories + vehicle-related totals for one month."""
    permission_classes = [ScopedPermission]

    def get(self, request):
        _require_owner(request)
        month = request.query_params.get("month")
        if not month or not _MONTH.match(month):
            return Response({"month": "Use YYYY-MM."}, status=400)
        y, m = int(month[:4]), int(month[5:7])
        owner = request.user
        cats = {k: 0 for k in ["binafsi", "chakula", "ofisi", "mgonjwa", "hospitali", "michango",
                               "vocha", "umeme", "maji", "mavazi", "mengineyo", "makato"]}
        for row in PersonalExpense.objects.filter(owner=owner, day__year=y, day__month=m).values("category").annotate(t=Sum("amount")):
            cats[row["category"]] = row["t"] or 0
        vehicles = owner.vehicles.all()
        service = sum(s.count * s.unit_price for s in ServiceRecord.objects.filter(vehicle__in=vehicles, day__year=y, day__month=m))
        tairi = TyreRecord.objects.filter(vehicle__in=vehicles, day__year=y, day__month=m).aggregate(t=Sum("amount"))["t"] or 0
        bima = InsuranceRecord.objects.filter(vehicle__in=vehicles, day__year=y, day__month=m).aggregate(t=Sum("amount"))["t"] or 0
        malipo = PaymentRecord.objects.filter(vehicle__in=vehicles, day__year=y, day__month=m).aggregate(t=Sum("amount"))["t"] or 0
        deni = ManualLedgerEntry.objects.filter(vehicle__in=vehicles, kind="MANUAL_DEBT", day__year=y, day__month=m).aggregate(t=Sum("amount"))["t"] or 0
        total = sum(cats.values())
        return Response({"month": month, "categories": cats, "vehicle": {
            "service": service, "tairi": tairi, "bima": bima, "deni": deni, "malipo": malipo},
            "total_personal": total})


class ReportView(APIView):
    """GET /api/reports/?from=YYYY-MM&to=YYYY-MM[&vehicle=<id>] for the signed-in owner only."""
    permission_classes = [ScopedPermission]

    def get(self, request):
        _require_owner(request)
        start = request.query_params.get("from", "")
        end = request.query_params.get("to", "")
        if not _MONTH.match(start) or not _MONTH.match(end) or start > end:
            return Response({"detail": "Use from=YYYY-MM and to=YYYY-MM, with from before to."}, status=400)
        if len(months_between(start, end)) > 36:
            return Response({"detail": "Choose 36 months or fewer."}, status=400)
        vid = request.query_params.get("vehicle")
        vehicle_id = None
        if vid:
            if not vid.isdigit():
                return Response({"detail": "Vehicle si sahihi."}, status=400)
            # Gari lazima liwe la owner huyu, vinginevyo 404.
            vehicle_id = get_object_or_404(vehicles_for(request.user), pk=int(vid)).id
        return Response(build_report(request.user, start, end, vehicle_id))


# ---------------------------------------------------------------- team

class TeamViewSet(viewsets.ViewSet):
    """Owner registers, lists and removes managers and drivers. Staff cannot use this."""
    permission_classes = [ScopedPermission]
    manager_can_write = False

    def list(self, request):
        _require_owner(request)
        rows = []
        for m in Membership.objects.filter(business_owner=request.user).select_related("user").prefetch_related("vehicles"):
            rows.append({"id": m.id, "username": m.user.username, "role": m.role, "phone": m.phone,
                         "vehicles": [{"id": v.id, "name": v.name} for v in m.vehicles.all()]})
        return Response(rows)

    def create(self, request):
        _require_owner(request)
        ser = TeamMemberSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        if len(str(d.get("password", ""))) < MIN_PASSWORD_LEN:
            return Response({"password": "Nenosiri lazima liwe na herufi 6 au zaidi."}, status=400)
        if get_user_model().objects.filter(username=d["username"]).exists():
            return Response({"username": "Jina hili limeshatumika."}, status=400)
        mine = Vehicle.objects.filter(owner=request.user, id__in=d.get("vehicles", []))
        if d["role"] == "driver" and mine.count() > 1:
            return Response({"vehicles": "Dereva anapangiwa gari moja tu."}, status=400)
        user = get_user_model().objects.create_user(username=d["username"], password=d["password"])
        m = Membership.objects.create(user=user, business_owner=request.user, role=d["role"], phone=d.get("phone", ""))
        m.vehicles.set(mine)
        return Response({"id": m.id, "username": user.username, "role": m.role}, status=201)

    def destroy(self, request, pk=None):
        _require_owner(request)
        m = get_object_or_404(Membership, pk=pk, business_owner=request.user)
        user = m.user
        m.delete()
        user.delete()  # pia hufuta Token zake
        return Response(status=204)

    def partial_update(self, request, pk=None):
        """Owner edits a manager or driver. Changing the password logs them out everywhere."""
        _require_owner(request)
        m = get_object_or_404(Membership, pk=pk, business_owner=request.user)
        d = request.data
        user = m.user
        if "username" in d:
            name = str(d.get("username") or "").strip()
            if not name:
                return Response({"username": "Jina haliwezi kuwa tupu."}, status=400)
            if name != user.username and get_user_model().objects.filter(username=name).exists():
                return Response({"username": "Jina hili limeshatumika."}, status=400)
            user.username = name[:150]
        password_changed = False
        if d.get("password"):
            pw = str(d["password"])
            if len(pw) < MIN_PASSWORD_LEN:
                return Response({"password": "Nenosiri lazima liwe na herufi 6 au zaidi."}, status=400)
            user.set_password(pw)
            password_changed = True
        role = d.get("role", m.role)
        if role not in ("manager", "driver"):
            return Response({"role": "Role si sahihi."}, status=400)
        mine = None
        if d.get("vehicles") is not None:
            mine = Vehicle.objects.filter(owner=request.user, id__in=d.get("vehicles"))
        count = mine.count() if mine is not None else m.vehicles.count()
        if role == "driver" and count > 1:
            return Response({"vehicles": "Dereva anapangiwa gari moja tu."}, status=400)
        user.save()
        if password_changed:
            Token.objects.filter(user=user).delete()
        m.role = role
        if "phone" in d:
            m.phone = str(d.get("phone") or "")[:20]
        m.save()
        if mine is not None:
            m.vehicles.set(mine)
        return Response({"id": m.id, "username": user.username, "role": m.role})


# ---------------------------------------------------------------- profile and auth

class LogoutView(APIView):
    """Futa token ya sasa. Inatoa logout kwenye vifaa vyote vya mtumiaji huyo."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=204)


class MeView(APIView):
    """Profile of the signed-in user (any role). GET reads, PATCH edits name, phone, photo and appearance."""
    permission_classes = [IsAuthenticated]

    def _payload(self, user):
        m = membership_of(user)
        p = _profile(user)
        return {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "role": m.role if m else "owner",
            "business_owner": m.business_owner.username if m else user.username,
            "full_name": p.full_name,
            "business_name": p.business_name,
            "phone": p.phone or (m.phone if m else ""),
            "avatar": p.avatar,
            "theme": p.theme,
            "background": p.background,
            "accent": p.accent,
            "vehicles": [{"id": v.id, "name": v.name} for v in vehicles_for(user)],
        }

    def get(self, request):
        return Response(self._payload(request.user))

    def patch(self, request):
        p = _profile(request.user)
        m = membership_of(request.user)
        d = request.data
        if "first_name" in d:
            request.user.first_name = str(d.get("first_name") or "")[:150]
            request.user.save(update_fields=["first_name"])
        if "email" in d:
            new_email = str(d.get("email") or "").strip().lower()[:254]
            if new_email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", new_email):
                return Response({"email": "Andika email sahihi, mfano jina@mfano.com."}, status=400)
            if new_email != (request.user.email or "").lower():
                taken = get_user_model().objects.filter(username=new_email).exclude(pk=request.user.pk).exists() \
                    or get_user_model().objects.filter(email__iexact=new_email).exclude(pk=request.user.pk).exists()
                if taken:
                    return Response({"email": "Email hii tayari inatumika."}, status=400)
                # Owner login uses the email as username, so keep them in sync.
                if (request.user.username or "").lower() == (request.user.email or "").lower():
                    request.user.username = new_email
                request.user.email = new_email
                request.user.save(update_fields=["email", "username"])
        if "full_name" in d:
            p.full_name = str(d.get("full_name") or "")[:120]
        if "business_name" in d:
            p.business_name = str(d.get("business_name") or "")[:120]
        if "phone" in d:
            p.phone = str(d.get("phone") or "")[:20]
            if m:
                m.phone = p.phone
                m.save(update_fields=["phone"])
        if "avatar" in d:
            avatar = str(d.get("avatar") or "")
            if avatar and not _is_safe_image(avatar):
                return Response({"avatar": "Picha lazima iwe png, jpg, webp au gif."}, status=400)
            if len(avatar) > MAX_AVATAR_CHARS:
                return Response({"avatar": "Picha ni kubwa sana. Chagua picha ndogo."}, status=400)
            p.avatar = avatar
        if "theme" in d:
            if d["theme"] not in THEME_VALUES:
                return Response({"theme": "Chagua light au dark."}, status=400)
            p.theme = d["theme"]
        if "background" in d:
            if d["background"] not in BG_VALUES:
                return Response({"background": "Mandhari hii haipo."}, status=400)
            p.background = d["background"]
        if "accent" in d:
            if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(d["accent"])):
                return Response({"accent": "Rangi lazima iwe kama #f97316."}, status=400)
            p.accent = d["accent"]
        p.save()
        return Response(self._payload(request.user))


# Jina la zamani, ili urls zilizopo zisivunjike.
MeProfileView = MeView


class ChallengeViewSet(viewsets.ModelViewSet):
    """Challenges. Anyone who can see a vehicle can report on it. Only owner and manager can solve."""
    serializer_class = ChallengeSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = Challenge.objects.filter(vehicle__in=vehicles_for(self.request.user)).select_related("vehicle", "created_by")
        status_q = self.request.query_params.get("status")
        vehicle = self.request.query_params.get("vehicle")
        if status_q in ("open", "resolved"):
            qs = qs.filter(status=status_q)
        if vehicle and vehicle.isdigit():
            qs = qs.filter(vehicle_id=int(vehicle))
        return qs

    def perform_create(self, serializer):
        vehicle = serializer.validated_data["vehicle"]
        if vehicle not in vehicles_for(self.request.user):
            raise PermissionDenied("Gari hili si lako.")
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def solve(self, request, pk=None):
        if role_of(request.user) not in ("owner", "manager"):
            raise PermissionDenied("Owner au manager pekee ndiye anaweza kutatua changamoto.")
        obj = self.get_object()
        obj.status = "resolved"
        obj.resolved_at = timezone.now()
        obj.resolved_by = request.user
        obj.save(update_fields=["status", "resolved_at", "resolved_by"])
        return Response(self.get_serializer(obj).data)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RegisterThrottle])
def register_owner(request):
    """Owner self-registration: creates the owner account and returns a login token."""
    d = request.data
    required = ["full_name", "business_name", "phone", "email", "password"]
    missing = [k for k in required if not str(d.get(k, "")).strip()]
    if missing:
        return Response({"detail": "Jaza sehemu zote zilizo na *."}, status=400)
    email = str(d["email"]).strip().lower()
    if len(str(d["password"])) < MIN_PASSWORD_LEN:
        return Response({"detail": "Nenosiri lazima liwe na herufi 6 au zaidi."}, status=400)
    if get_user_model().objects.filter(username=email).exists():
        return Response({"detail": "Email hii imeshasajiliwa."}, status=400)
    user = get_user_model().objects.create_user(username=email, email=email, password=str(d["password"]))
    UserProfile.objects.create(user=user, full_name=str(d["full_name"])[:120],
                               business_name=str(d["business_name"])[:120], phone=str(d["phone"])[:20])
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username}, status=201)


# ---------------------------------------------------------------- health check (cron-job.org)

from django.db import connection


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    # Haturudishi ujumbe wa exception kwa umma; logs zinabaki Render.
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return Response({"status": "ok", "database": "awake"}, status=200)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("health check failed")
        return Response({"status": "error"}, status=500)
