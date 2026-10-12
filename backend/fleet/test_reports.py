from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from fleet.models import Vehicle, DriverPeriod, Return, LostDays, ServiceRecord, PaymentRecord, PersonalExpense

User = get_user_model()


class ReportTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("rep_owner", password="x")
        self.other = User.objects.create_user("rep_other", password="x")
        self.v = Vehicle.objects.create(owner=self.owner, name="R1", daily_target=16000, working_days_count=6)
        DriverPeriod.objects.create(vehicle=self.v, driver_name="Juma", from_date=date(1900, 1, 1))
        Return.objects.create(vehicle=self.v, day=date(2026, 1, 5), amount=96000)
        LostDays.objects.create(vehicle=self.v, month="2026-01", week_number=1, days=1)
        ServiceRecord.objects.create(vehicle=self.v, day=date(2026, 1, 9), tool="Oil", count=1, unit_price=5000)
        PaymentRecord.objects.create(vehicle=self.v, day=date(2026, 1, 10), payment_type="TRA", amount=2000)
        PaymentRecord.objects.create(vehicle=self.v, day=date(2026, 1, 11), payment_type="debt_payment", amount=3000)
        PersonalExpense.objects.create(owner=self.owner, day=date(2026, 1, 12), category="chakula", amount=4000)
        self.client.force_authenticate(self.owner)

    def test_report_totals_follow_the_rules(self):
        r = self.client.get("/api/reports/", {"from": "2026-01", "to": "2026-01"})
        self.assertEqual(r.status_code, 200)
        t = r.data["totals"]
        self.assertEqual(t["collected"], 96000)
        self.assertEqual(t["lost_days"], 1)
        self.assertEqual(t["lost_amount"], 16000)
        self.assertEqual(t["expenses"], 5000 + 2000)          # service + TRA; debt payment is not an expense
        # A debt payment only reduces debt that exists. Here there was no debt, so 0 is applied (existing rule).
        self.assertEqual(t["debt_payments"], 0)
        self.assertEqual(t["personal"], 4000)
        self.assertEqual(t["profit"], 96000 - 7000 - 4000 - 16000)
        self.assertEqual(r.data["vehicles"][0]["driver"], "Juma")

    def test_target_is_not_counted_as_collected(self):
        r = self.client.get("/api/reports/", {"from": "2026-01", "to": "2026-01"})
        self.assertNotEqual(r.data["totals"]["target"], r.data["totals"]["collected"])

    def test_bad_range_and_other_owner(self):
        r = self.client.get("/api/reports/", {"from": "2026-03", "to": "2026-01"})
        self.assertEqual(r.status_code, 400)
        self.client.force_authenticate(self.other)
        r = self.client.get("/api/reports/", {"from": "2026-01", "to": "2026-01"})
        self.assertEqual(r.data["totals"]["collected"], 0)
        self.assertEqual(r.data["vehicles"], [])
