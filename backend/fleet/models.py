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
    # NEW: siku za kazi za kawaida, 0=Jumatatu ... 6=Jumapili. None = siku za mwanzo (working_days_count).
    active_days = models.JSONField(null=True, blank=True)
    # NEW: kipindi cha mapato (tarehe ya kuanza na ya mwisho). None = hakuna kikomo.
    income_start = models.DateField(null=True, blank=True)
    income_end = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = [("owner", "name")]

    def __str__(self):
        return self.name


# NEW MODEL: mipangilio ya wiki moja mahususi (mwezi + namba ya wiki)
class WeekSetting(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="week_settings")
    month = models.CharField(max_length=7)                      # "2026-10"
    week_number = models.PositiveSmallIntegerField()            # 1..5
    active_days = models.JSONField(null=True, blank=True)       # None = tumia siku za gari
    target = models.PositiveIntegerField(null=True, blank=True) # None = kiotomatiki

    class Meta:
        unique_together = [("vehicle", "month", "week_number")]

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
    confirmed_at = models.DateTimeField(null=True, blank=True)
    # Which week this money belongs to (chosen on the form). Empty = old records: week is found from `day`.
    record_month = models.CharField(max_length=7, blank=True)   # "2026-10"
    week_number = models.PositiveSmallIntegerField(null=True, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)


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
    confirmed_at = models.DateTimeField(null=True, blank=True)


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
    confirmed_at = models.DateTimeField(null=True, blank=True)


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


class PersonalExpense(models.Model):
    """Owner's personal spending (Matumizi) and deductions (Makato). Owner-level, not per vehicle."""
    CATEGORIES = [
        ("binafsi", "Binafsi"), ("chakula", "Chakula"), ("ofisi", "Ofisi"),
        ("mgonjwa", "Mgonjwa"), ("hospitali", "Hospitali"), ("michango", "Michango"),
        ("vocha", "Vocha"), ("umeme", "Umeme"), ("maji", "Maji"), ("mavazi", "Mavazi"),
        ("mengineyo", "Mengineyo"), ("makato", "Makato"),
    ]
    MAKATO_TYPES = [("pesafasta", "Pesafasta"), ("atm", "ATM"), ("mitandao", "Mitandao ya Simu")]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="personal_expenses")
    day = models.DateField()
    category = models.CharField(max_length=20, choices=CATEGORIES)
    amount = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=200, blank=True)
    makato_type = models.CharField(max_length=20, blank=True)
    transaction_amount = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["day", "id"]


class Membership(models.Model):
    """A manager or driver who works for one owner (business_owner)."""
    ROLES = [("manager", "Manager"), ("driver", "Driver")]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="membership")
    business_owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="team")
    role = models.CharField(max_length=10, choices=ROLES)
    phone = models.CharField(max_length=20, blank=True)
    vehicles = models.ManyToManyField(Vehicle, blank=True, related_name="members")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class UserProfile(models.Model):
    """Profile and app settings for any signed-in user (owner, manager or driver)."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    phone = models.CharField(max_length=20, blank=True)
    photo = models.TextField(blank=True)          # small data URL (max ~150 KB), see views
    settings = models.JSONField(default=dict, blank=True)


class Challenge(models.Model):
    """Changamoto: a problem reported on a vehicle. Driver reports, owner or manager resolves."""
    STATUS = [("open", "Open"), ("resolved", "Resolved")]
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="challenges")
    title = models.CharField(max_length=120)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default="open")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="challenges_made")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="challenges_solved")
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class UserProfile(models.Model):
    """Profile and appearance settings for any signed-in user (owner, manager or driver)."""
    THEMES = [("light", "Light"), ("dark", "Dark")]
    BACKGROUNDS = [("adybajaj", "AdyBajaj"), ("ocean", "Ocean"), ("emerald", "Emerald"), ("sunset", "Sunset"), ("violet", "Violet")]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=120, blank=True)
    business_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.TextField(blank=True)            # small image as a data URL (max ~200 KB, checked in the API)
    theme = models.CharField(max_length=10, choices=THEMES, default="light")
    background = models.CharField(max_length=20, choices=BACKGROUNDS, default="adybajaj")
    accent = models.CharField(max_length=7, default="#f97316")   # hex colour like #f97316


class Challenge(models.Model):
    """Problem report. Driver/manager/owner create it; owner or manager solves it; driver sees 'resolved'."""
    STATUS = [("open", "Open"), ("resolved", "Resolved")]
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="challenges")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="challenges_made")
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default="open")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="challenges_solved")

    class Meta:
        ordering = ["-created_at", "-id"]
