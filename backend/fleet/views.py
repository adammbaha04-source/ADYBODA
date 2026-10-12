from django.shortcuts import get_object_or_404
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
    """Every query is limited to vehicles the current user owns. Anyone else gets 404."""

    def owned_vehicle(self, vehicle_id):
        return get_object_or_404(Vehicle, pk=vehicle_id, owner=self.request.user)


class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer

    def get_queryset(self):
        return Vehicle.objects.filter(owner=self.request.user).prefetch_related("driver_periods")

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
        return DriverPeriod.objects.filter(vehicle__owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))


class ReturnViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = ReturnSerializer

    def get_queryset(self):
        qs = Return.objects.filter(vehicle__owner=self.request.user)
        v = self.request.query_params.get("vehicle")
        return qs.filter(vehicle_id=v) if v else qs

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))


class LostDaysViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = LostDaysSerializer

    def get_queryset(self):
        return LostDays.objects.filter(vehicle__owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")))


class ManualLedgerViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    serializer_class = ManualLedgerEntrySerializer

    def get_queryset(self):
        return ManualLedgerEntry.objects.filter(vehicle__owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(vehicle=self.owned_vehicle(self.request.data.get("vehicle")),
                        created_by=self.request.user)


class _VehicleChildViewSet(OwnedVehicleMixin, viewsets.ModelViewSet):
    """Base for records that belong to a vehicle. Filter with ?vehicle=<id>."""
    model = None

    def get_queryset(self):
        qs = self.model.objects.filter(vehicle__owner=self.request.user)
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


from rest_framework.views import APIView
from django.db.models import Sum
from fleet.fees import makato_fee
from fleet.models import PersonalExpense, ManualLedgerEntry
from fleet.serializers import PersonalExpenseSerializer


class PersonalExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = PersonalExpenseSerializer

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
    """Totals for the Matumizi tab: personal categories + vehicle-related totals for one month."""

    def get(self, request):
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
