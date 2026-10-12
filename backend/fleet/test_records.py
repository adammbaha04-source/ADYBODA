from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from fleet.models import Vehicle, DriverPeriod
from fleet.services import vehicle_debt

User = get_user_model()


class RecordsTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("rec_owner", password="x")
        self.other = User.objects.create_user("rec_other", password="x")
        self.v = Vehicle.objects.create(owner=self.owner, name="T1", daily_target=16000, working_days_count=6)
        DriverPeriod.objects.create(vehicle=self.v, driver_name="Juma", from_date=date(1900, 1, 1))
        self.client.force_authenticate(self.owner)

    def test_service_total_and_list_filter(self):
        r = self.client.post("/api/service-records/", {"vehicle": self.v.id, "day": "2026-10-12",
                                                      "tool": "Mafuta", "count": 2, "unit_price": 5000,
                                                      "seller": "Duka"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["total"], 10000)
        r = self.client.get("/api/service-records/", {"vehicle": self.v.id})
        self.assertEqual(len(r.data), 1)

    def test_tra_payment_does_not_reduce_debt(self):
        self.client.post("/api/payment-records/", {"vehicle": self.v.id, "day": "2026-01-10",
                                                  "payment_type": "TRA", "amount": 50000}, format="json")
        entries = vehicle_debt(self.v, "2026-01")
        self.assertEqual(entries[-1].remaining_debt, 96000 * 4)

    def test_debt_payment_reduces_debt(self):
        self.client.post("/api/payment-records/", {"vehicle": self.v.id, "day": "2026-01-10",
                                                  "payment_type": "debt_payment", "amount": 16000}, format="json")
        entries = vehicle_debt(self.v, "2026-01")
        self.assertEqual(entries[-1].remaining_debt, 96000 * 4 - 16000)

    def test_other_owner_cannot_add_records(self):
        self.client.force_authenticate(self.other)
        r = self.client.post("/api/tyre-records/", {"vehicle": self.v.id, "day": "2026-10-12", "amount": 1}, format="json")
        self.assertEqual(r.status_code, 404)
