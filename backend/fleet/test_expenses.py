from datetime import date
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.test import APITestCase
from fleet.fees import makato_fee
from fleet.models import Vehicle, ServiceRecord

User = get_user_model()


class FeeTests(SimpleTestCase):
    def test_pesafasta_bands(self):
        self.assertEqual(makato_fee("pesafasta", 19999), 1100)
        self.assertEqual(makato_fee("pesafasta", 20000), 1300)
        self.assertEqual(makato_fee("pesafasta", 400001), 0)

    def test_atm_and_mitandao(self):
        self.assertEqual(makato_fee("atm", 199999), 2000)
        self.assertEqual(makato_fee("mitandao", 1000000), 4000)
        self.assertEqual(makato_fee("unknown", 5000), 0)


class ExpenseApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("exp_owner", password="x")
        self.other = User.objects.create_user("exp_other", password="x")
        self.client.force_authenticate(self.owner)

    def test_makato_fee_is_computed_by_server(self):
        r = self.client.post("/api/personal-expenses/", {"day": "2026-10-12", "category": "makato",
                             "makato_type": "atm", "transaction_amount": 150000, "amount": 1}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["amount"], 2000)

    def test_month_filter_and_summary(self):
        self.client.post("/api/personal-expenses/", {"day": "2026-10-03", "category": "chakula", "amount": 5000}, format="json")
        self.client.post("/api/personal-expenses/", {"day": "2026-09-30", "category": "chakula", "amount": 9000}, format="json")
        r = self.client.get("/api/personal-expenses/", {"month": "2026-10"})
        self.assertEqual(len(r.data), 1)
        r = self.client.get("/api/expense-summary/", {"month": "2026-10"})
        self.assertEqual(r.data["categories"]["chakula"], 5000)
        self.assertEqual(r.data["total_personal"], 5000)

    def test_vehicle_service_total_in_summary(self):
        v = Vehicle.objects.create(owner=self.owner, name="T9", daily_target=16000, working_days_count=6)
        ServiceRecord.objects.create(vehicle=v, day=date(2026, 10, 2), tool="Oil", count=2, unit_price=3000)
        r = self.client.get("/api/expense-summary/", {"month": "2026-10"})
        self.assertEqual(r.data["vehicle"]["service"], 6000)

    def test_other_owner_cannot_see_expenses(self):
        self.client.post("/api/personal-expenses/", {"day": "2026-10-03", "category": "ofisi", "amount": 700}, format="json")
        self.client.force_authenticate(self.other)
        r = self.client.get("/api/personal-expenses/", {"month": "2026-10"})
        self.assertEqual(len(r.data), 0)


class NewCategoryTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("cat_owner", password="x")
        self.client.force_authenticate(self.owner)

    def test_new_categories_save_and_summarise(self):
        for cat in ["umeme", "maji", "hospitali", "vocha"]:
            r = self.client.post("/api/personal-expenses/", {"day": "2026-10-05", "category": cat, "amount": 1000}, format="json")
            self.assertEqual(r.status_code, 201, cat)
        r = self.client.get("/api/expense-summary/", {"month": "2026-10"})
        self.assertEqual(r.data["categories"]["umeme"], 1000)
        self.assertEqual(r.data["total_personal"], 4000)
