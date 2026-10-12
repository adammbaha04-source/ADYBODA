from django.conf import settings
from django.db import models


class Vehicle(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vehicles")
    name = models.CharField(max_length=32)
    legacy_id = models.CharField(max_length=64, blank=True, db_index=True)  # Firebase doc id
    vehicle_type = models.CharField(max_length=20, default="Bajaj")
    daily_target = models.PositiveIntegerField()              # TZS, whole shillings
    working_days_count = models.PositiveSmallIntegerField(default=6)
    include_week5 = models.BooleanField(default=False)
    no_carry_months = models.JSONField(default=list)          # ["2026-03", ...]

    class Meta:
        unique_together = [("owner", "name")]

    def __str__(self):
        return self.name


class DriverPeriod(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="driver_periods")
    driver_name = models.CharField(max_length=80, blank=True)  # blank = vehicle without driver
    phone = models.CharField(max_length=20, blank=True)
    from_date = models.DateField()

    class Meta:
        ordering = ["from_date"]


class Return(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="returns")
    day = models.DateField()
    amount = models.PositiveIntegerField()
    is_excess = models.BooleanField(default=False)


class LostDays(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="lost_days")
    month = models.CharField(max_length=7)                    # "2026-09"
    week_number = models.PositiveSmallIntegerField()
    days = models.PositiveSmallIntegerField()

    class Meta:
        unique_together = [("vehicle", "month", "week_number")]


class ManualLedgerEntry(models.Model):
    """Entries typed in by hand: manual debt, manual payment, opening carry-over."""
    KINDS = [("MANUAL_DEBT", "Kakopa"), ("MANUAL_PAYMENT", "Malipo ya Deni"), ("CARRY_OVER", "Deni lililobaki")]
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="manual_entries")
    kind = models.CharField(max_length=20, choices=KINDS)
    day = models.DateField()
    amount = models.PositiveIntegerField()
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)


class PaymentRecord(models.Model):
    """Payments from the old app's "Add Payment" form. Only debt_payment reduces debt."""
    TYPES = [
        ("TRA", "TRA Taxes"),
        ("maegesho", "Maegesho (Parking)"),
        ("wrong_parking", "Wrong Parking Fine"),
        ("police", "Police Fine"),
        ("debt_payment", "Malipo ya Deni"),
    ]
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="payment_records")
    day = models.DateField()
    payment_type = models.CharField(max_length=20, choices=TYPES)
    amount = models.PositiveIntegerField()
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["day", "id"]


class ServiceRecord(models.Model):
    """Service / Service ya Pamoja: tool, count, unit price, seller."""
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="service_records")
    day = models.DateField()
    tool = models.CharField(max_length=80, blank=True)
    count = models.PositiveIntegerField(default=1)
    unit_price = models.PositiveIntegerField(default=0)
    seller = models.CharField(max_length=80, blank=True)
    note = models.CharField(max_length=200, blank=True)

    @property
    def total(self) -> int:
        return self.count * self.unit_price

    class Meta:
        ordering = ["day", "id"]


class TyreRecord(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="tyre_records")
    day = models.DateField()
    tyre_number = models.CharField(max_length=40, blank=True)
    amount = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["day", "id"]


class InsuranceRecord(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="insurance_records")
    day = models.DateField()
    insurance_type = models.CharField(max_length=60, blank=True)
    amount = models.PositiveIntegerField(default=0)
    months = models.PositiveSmallIntegerField(default=12)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["day", "id"]
