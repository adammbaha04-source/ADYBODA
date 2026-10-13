from rest_framework import serializers
from fleet.models import (Vehicle, DriverPeriod, Return, LostDays, ManualLedgerEntry,
                          PaymentRecord, ServiceRecord, TyreRecord, InsuranceRecord)


class DriverPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverPeriod
        fields = ["id", "driver_name", "phone", "from_date"]


class VehicleSerializer(serializers.ModelSerializer):
    driver_periods = DriverPeriodSerializer(many=True, read_only=True)

    class Meta:
        model = Vehicle
        fields = ["id", "name", "vehicle_type", "daily_target", "working_days_count",
                  "include_week5", "no_carry_months", "driver_periods"]
        read_only_fields = ["no_carry_months"]

    def validate_daily_target(self, value):
        if value <= 0:
            raise serializers.ValidationError("Daily target must be greater than 0.")
        return value


class ReturnSerializer(serializers.ModelSerializer):
    class Meta:
        model = Return
        fields = ["id", "vehicle", "day", "amount", "is_excess", "confirmed_at"]
        read_only_fields = ["vehicle", "confirmed_at"]


class LostDaysSerializer(serializers.ModelSerializer):
    class Meta:
        model = LostDays
        fields = ["id", "vehicle", "month", "week_number", "days"]
        read_only_fields = ["vehicle"]


class ManualLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualLedgerEntry
        fields = ["id", "vehicle", "kind", "day", "amount", "note"]
        read_only_fields = ["vehicle"]


class PaymentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRecord
        fields = ["id", "vehicle", "day", "payment_type", "amount", "note", "confirmed_at"]
        read_only_fields = ["vehicle", "confirmed_at"]


class ServiceRecordSerializer(serializers.ModelSerializer):
    total = serializers.IntegerField(read_only=True)

    class Meta:
        model = ServiceRecord
        fields = ["id", "vehicle", "day", "tool", "count", "unit_price", "seller", "note", "total"]
        read_only_fields = ["vehicle"]


class TyreRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = TyreRecord
        fields = ["id", "vehicle", "day", "tyre_number", "amount", "note"]
        read_only_fields = ["vehicle"]


class InsuranceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsuranceRecord
        fields = ["id", "vehicle", "day", "insurance_type", "amount", "months", "note"]
        read_only_fields = ["vehicle"]


class PersonalExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        from fleet.models import PersonalExpense
        model = PersonalExpense
        fields = ["id", "day", "category", "amount", "note", "makato_type", "transaction_amount"]


class TeamMemberSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=6, write_only=True)
    role = serializers.ChoiceField(choices=["manager", "driver"])
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    vehicles = serializers.ListField(child=serializers.IntegerField(), allow_empty=True, required=False)
