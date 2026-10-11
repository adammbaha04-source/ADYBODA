from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from fleet.models import Vehicle, DriverPeriod, Return, LostDays, ManualLedgerEntry
from fleet.serializers import (VehicleSerializer, DriverPeriodSerializer, ReturnSerializer,
                               LostDaysSerializer, ManualLedgerEntrySerializer)
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
