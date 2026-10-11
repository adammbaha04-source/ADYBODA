from rest_framework import serializers
from fleet.models import Vehicle, DriverPeriod, Return, LostDays, ManualLedgerEntry


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
        fields = ["id", "vehicle", "day", "amount", "is_excess"]
        read_only_fields = ["vehicle"]


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
