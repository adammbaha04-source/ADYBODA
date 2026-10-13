from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from fleet.access import ScopedPermission, vehicles_for, role_of, business_owner
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from fleet.models import (Vehicle, DriverPeriod, Return, LostDays, ManualLedgerEntry,
                          PaymentRecord, ServiceRecord, TyreRecord, InsuranceRecord)
from fleet.serializers import (VehicleSerializer, DriverPeriodSerializer, ReturnSerializer,
                               LostDaysSerializer, ManualLedgerEntrySerializer,
                               PaymentRecordSerializer, ServiceRecordSerializer,
                               TyreRecordSerializer, InsuranceRecordSerializer)
from fleet.services import vehicle_debt, debt_summary, serialize_entries


class OwnedVehicleMixin:
    permission_classes = [ScopedPermission]
    manager_can_write = True
    """Every query is limited to vehicles the current user owns. Anyone else gets 404."""

    def owned_vehicle(self, vehicle_id):
        return get_object_or_404(vehicles_for(self.request.user), pk=vehicle_id)


class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer
    permission_classes = [ScopedPermission]
    manager_can_write = False

    def get_queryset(self):
        return vehicles_for(self.request.user).prefetch_related("driver_periods")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def debt(self, request, pk=None):
        vehicle = self.get_object()
        month = request.query_params.get("month")
        if not month or len(month) != 7:
            raise ValidationError({"month": "Use YYYY-MM."})
        entries = vehicle_debt(vehicle, month)
        month_entries = [e for e in entries if e.month == month]
        return Response({"summary": debt_summary(entries, month, vehicle),
                         "entries": serialize_entries(month_entries)})

    @action(detail=True, methods=["post"])
    def carry(self, request, pk=None):
        """Turn carry-over on or off for one month."""
        vehicle = self.get_object()
        month = request.data.get("month")
        carry = bool(request.data.get("carry", True))
        if not month or len(str(month)) != 7:
            raise ValidationError({"month": "Use YYYY-MM."})
        months = set(vehicle.no_carry_months)
        if carry:
            months.discard(month)
        else:
            months.add(month)
        vehicle.no_carry_months = sorted(months)
        vehicle.save(update_fields=["no_carry_months"])
        return Response({"no_carry_months": vehicle.no_carry_months})


class DriverPeriodViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = DriverPeriodSerializer

    def get_queryset(self):
        return DriverPeriod.objects.filter(vehicle__in=vehicles_for(self.request.user))

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))


class ReturnViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = ReturnSerializer

    def get_queryset(self):
        qs = Return.objects.filter(vehicle__in=vehicles_for(self.request.user))
        v = self.request.query_params.get("vehicle")
        return qs.filter(vehicle_id=v) if v else qs

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Driver signs a record for his own vehicle. Only the driver can confirm."""
        if role_of(request.user) != "driver":
            raise PermissionDenied("Only the driver can confirm a record.")
        obj = self.get_object()
        obj.confirmed_at = timezone.now()
        obj.save(update_fields=["confirmed_at"])
        return Response(self.get_serializer(obj).data)


class LostDaysViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = LostDaysSerializer

    def get_queryset(self):
        return LostDays.objects.filter(vehicle__in=vehicles_for(self.request.user))

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))


class ManualLedgerViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = ManualLedgerEntrySerializer

    def get_queryset(self):
        return ManualLedgerEntry.objects.filter(vehicle__in=vehicles_for(self.request.user))

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")),
                        created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Driver signs a record for his own vehicle. Only the driver can confirm."""
        if role_of(request.user) != "driver":
            raise PermissionDenied("Only the driver can confirm a record.")
        obj = self.get_object()
        obj.confirmed_at = timezone.now()
        obj.save(update_fields=["confirmed_at"])
        return Response(self.get_serializer(obj).data)


class _VehicleChildViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    """Base for records that belong to a vehicle. Filter with ?vehicle=<id>."""
    model = None

    def get_queryset(self):
        qs = self.model.objects.filter(vehicle__in=vehicles_for(self.request.user))
        v = self.request.query_params.get("vehicle")
        return qs.filter(vehicle_id=v) if v else qs

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Driver signs a record for his own vehicle. Only the driver can confirm."""
        if role_of(request.user) != "driver":
            raise PermissionDenied("Only the driver can confirm a record.")
        obj = self.get_object()
        obj.confirmed_at = timezone.now()
        obj.save(update_fields=["confirmed_at"])
        return Response(self.get_serializer(obj).data)


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


from rest_framework.views import APIView
from django.db.models import Sum
from fleet.fees import makato_fee
from fleet.models import PersonalExpense, ManualLedgerEntry
from fleet.serializers import PersonalExpenseSerializer


class PersonalExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = PersonalExpenseSerializer
    permission_classes = [ScopedPermission]
    manager_can_write = False

    def get_queryset(self):
        qs = PersonalExpense.objects.filter(owner=self.request.user)
        month = self.request.query_params.get("month")
        return qs.filter(day__year=int(month[:4]), day__month=int(month[5:7])) if month else qs

    def perform_create(self, serializer):
        data = serializer.validated_data
        amount = data.get("amount", 0)
        if data.get("category") == "makato":
            amount = makato_fee(data.get("makato_type", ""), data.get("transaction_amount") or 0)
        serializer.save(owner=self.request.user, amount=amount)


class ExpenseSummaryView(APIView):
    permission_classes = [ScopedPermission]
    """Totals for the Matumizi tab: personal categories + vehicle-related totals for one month."""

    def get(self, request):
        if role_of(request.user) != "owner":
            raise PermissionDenied("Owner only.")
        month = request.query_params.get("month")
        if not month or len(month) != 7:
            return Response({"month": "Use YYYY-MM."}, status=400)
        y, m = int(month[:4]), int(month[5:7])
        owner = request.user
        cats = {k: 0 for k in ["binafsi", "chakula", "ofisi", "mgonjwa", "hospitali", "michango", "vocha", "umeme", "maji", "mavazi", "mengineyo", "makato"]}
        for row in PersonalExpense.objects.filter(owner=owner, day__year=y, day__month=m).values("category").annotate(t=Sum("amount")):
            cats[row["category"]] = row["t"] or 0
        from fleet.models import ServiceRecord, TyreRecord, InsuranceRecord, PaymentRecord
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


from fleet.reports import build_report
from fleet.engine import months_between


class ReportView(APIView):
    permission_classes = [ScopedPermission]
    """GET /api/reports/?from=YYYY-MM&to=YYYY-MM[&vehicle=<id>] for the signed-in owner only."""

    def get(self, request):
        if role_of(request.user) != "owner":
            raise PermissionDenied("Owner only.")
        start = request.query_params.get("from", "")
        end = request.query_params.get("to", "")
        if len(start) != 7 or len(end) != 7 or start > end:
            return Response({"detail": "Use from=YYYY-MM and to=YYYY-MM, with from before to."}, status=400)
        if len(months_between(start, end)) > 36:
            return Response({"detail": "Choose 36 months or fewer."}, status=400)
        vid = request.query_params.get("vehicle")
        vehicle_id = int(vid) if vid and vid.isdigit() else None
        return Response(build_report(request.user, start, end, vehicle_id))


from django.contrib.auth import get_user_model
from fleet.models import Membership
from fleet.serializers import TeamMemberSerializer


def _require_owner(request):
    if role_of(request.user) != "owner":
        raise PermissionDenied("Owner only.")


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
        user.delete()
        return Response(status=204)


class MeView(APIView):
    """Profile of the signed-in user: role, business, assigned vehicles, phone (staff)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        m = Membership.objects.filter(user=request.user).select_related("business_owner").first()
        return Response({
            "username": request.user.username,
            "role": m.role if m else "owner",
            "business_owner": m.business_owner.username if m else request.user.username,
            "phone": m.phone if m else "",
            "vehicles": [{"id": v.id, "name": v.name} for v in vehicles_for(request.user)],
        })

    def patch(self, request):
        m = Membership.objects.filter(user=request.user).first()
        if m is None:
            return Response({"detail": "Owner profile edit comes later."}, status=400)
        if "phone" in request.data:
            m.phone = str(request.data.get("phone", ""))[:20]
            m.save(update_fields=["phone"])
        return Response({"phone": m.phone})
