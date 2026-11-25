from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from fleet.models import Vehicle, Membership

User = get_user_model()


class DebtLimitTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("limit_boss", password="x")
        self.v1 = Vehicle.objects.create(owner=self.owner, name="L1", daily_target=16000, working_days_count=6)
        self.v2 = Vehicle.objects.create(owner=self.owner, name="L2", daily_target=16000, working_days_count=6)
        self.manager = User.objects.create_user("limit_mgr", password="x")
        Membership.objects.create(user=self.manager, business_owner=self.owner, role="manager").vehicles.set([self.v1])
        self.driver = User.objects.create_user("limit_drv", password="x")
        Membership.objects.create(user=self.driver, business_owner=self.owner, role="driver").vehicles.set([self.v1])

    def test_owner_sets_limit_and_it_is_saved(self):
        self.client.force_authenticate(self.owner)
        r = self.client.patch(f"/api/vehicles/{self.v1.id}/", {"debt_limit": 500000}, format="json")
        self.assertEqual(r.status_code, 200)
        self.v1.refresh_from_db()
        self.assertEqual(self.v1.debt_limit, 500000)
        rows = {v["id"]: v for v in self.client.get("/api/vehicles/").data}
        self.assertEqual(rows[self.v1.id]["debt_limit"], 500000)

    def test_manager_can_set_limit_on_assigned_vehicle_only(self):
        self.client.force_authenticate(self.manager)
        r = self.client.patch(f"/api/vehicles/{self.v1.id}/", {"debt_limit": 300000}, format="json")
        self.assertEqual(r.status_code, 200)
        r = self.client.patch(f"/api/vehicles/{self.v2.id}/", {"debt_limit": 300000}, format="json")
        self.assertEqual(r.status_code, 404)

    def test_driver_cannot_set_limit_but_can_read_it(self):
        self.v1.debt_limit = 200000
        self.v1.save(update_fields=["debt_limit"])
        self.client.force_authenticate(self.driver)
        r = self.client.patch(f"/api/vehicles/{self.v1.id}/", {"debt_limit": 1}, format="json")
        self.assertEqual(r.status_code, 403)
        self.v1.refresh_from_db()
        self.assertEqual(self.v1.debt_limit, 200000)
        rows = self.client.get("/api/vehicles/").data
        self.assertEqual(rows[0]["debt_limit"], 200000)

    def test_zero_or_negative_limit_is_rejected(self):
        self.client.force_authenticate(self.owner)
        for bad in (0, -5):
            r = self.client.patch(f"/api/vehicles/{self.v1.id}/", {"debt_limit": bad}, format="json")
            self.assertEqual(r.status_code, 400)

    def test_null_clears_the_limit(self):
        self.v1.debt_limit = 100000
        self.v1.save(update_fields=["debt_limit"])
        self.client.force_authenticate(self.owner)
        r = self.client.patch(f"/api/vehicles/{self.v1.id}/", {"debt_limit": None}, format="json")
        self.assertEqual(r.status_code, 200)
        self.v1.refresh_from_db()
        self.assertIsNone(self.v1.debt_limit)
