from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from fleet.models import Vehicle, Membership, Return

User = get_user_model()


class RolesTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("boss", password="x")
        self.other_owner = User.objects.create_user("boss2", password="x")
        self.v1 = Vehicle.objects.create(owner=self.owner, name="V1", daily_target=16000, working_days_count=6)
        self.v2 = Vehicle.objects.create(owner=self.owner, name="V2", daily_target=16000, working_days_count=6)
        self.foreign = Vehicle.objects.create(owner=self.other_owner, name="X1", daily_target=16000, working_days_count=6)
        self.manager = User.objects.create_user("mgr", password="x")
        self.mgr = Membership.objects.create(user=self.manager, business_owner=self.owner, role="manager")
        self.mgr.vehicles.set([self.v1])
        self.driver = User.objects.create_user("drv", password="x")
        self.drv = Membership.objects.create(user=self.driver, business_owner=self.owner, role="driver", phone="0655")
        self.drv.vehicles.set([self.v2])
        self.r_v2 = Return.objects.create(vehicle=self.v2, day=date(2026, 10, 5), amount=16000)

    def test_owner_sees_all_own_vehicles_only(self):
        self.client.force_authenticate(self.owner)
        ids = [v["id"] for v in self.client.get("/api/vehicles/").data]
        self.assertIn(self.v1.id, ids); self.assertIn(self.v2.id, ids); self.assertNotIn(self.foreign.id, ids)

    def test_manager_sees_only_assigned_vehicle_and_can_record(self):
        self.client.force_authenticate(self.manager)
        ids = [v["id"] for v in self.client.get("/api/vehicles/").data]
        self.assertEqual(ids, [self.v1.id])
        r = self.client.post("/api/returns/", {"vehicle": self.v1.id, "day": "2026-10-06", "amount": 5000}, format="json")
        self.assertEqual(r.status_code, 201)
        r = self.client.post("/api/returns/", {"vehicle": self.v2.id, "day": "2026-10-06", "amount": 5000}, format="json")
        self.assertEqual(r.status_code, 404)

    def test_manager_cannot_create_vehicle_or_team(self):
        self.client.force_authenticate(self.manager)
        r = self.client.post("/api/vehicles/", {"name": "NEW", "daily_target": 1, "working_days_count": 6}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.client.get("/api/team/").status_code, 403)

    def test_driver_sees_only_own_vehicle_and_is_read_only(self):
        self.client.force_authenticate(self.driver)
        ids = [v["id"] for v in self.client.get("/api/vehicles/").data]
        self.assertEqual(ids, [self.v2.id])
        r = self.client.post("/api/returns/", {"vehicle": self.v2.id, "day": "2026-10-06", "amount": 1}, format="json")
        self.assertEqual(r.status_code, 403)
        r = self.client.delete(f"/api/returns/{self.r_v2.id}/")
        self.assertEqual(r.status_code, 403)

    def test_driver_confirms_only_own_record_and_manager_cannot(self):
        self.client.force_authenticate(self.driver)
        r = self.client.post(f"/api/returns/{self.r_v2.id}/confirm/")
        self.assertEqual(r.status_code, 200)
        self.assertIsNotNone(r.data["confirmed_at"])
        mine_v1 = Return.objects.create(vehicle=self.v1, day=date(2026, 10, 5), amount=1)
        r = self.client.post(f"/api/returns/{mine_v1.id}/confirm/")
        self.assertEqual(r.status_code, 404)
        self.client.force_authenticate(self.manager)
        r = self.client.post(f"/api/returns/{self.r_v2.id}/confirm/")
        self.assertIn(r.status_code, (403, 404))

    def test_owner_creates_team_member_and_driver_profile(self):
        self.client.force_authenticate(self.owner)
        r = self.client.post("/api/team/", {"username": "newdrv", "password": "secret1", "role": "driver",
                                            "phone": "0711", "vehicles": [self.v1.id]}, format="json")
        self.assertEqual(r.status_code, 201)
        u = User.objects.get(username="newdrv")
        self.client.force_authenticate(u)
        me = self.client.get("/api/me/").data
        self.assertEqual(me["role"], "driver")
        self.assertEqual([v["id"] for v in me["vehicles"]], [self.v1.id])
        r = self.client.patch("/api/me/", {"phone": "0799"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_staff_cannot_see_reports_or_personal_expenses(self):
        self.client.force_authenticate(self.driver)
        self.assertEqual(self.client.get("/api/reports/", {"from": "2026-10", "to": "2026-10"}).status_code, 403)
        self.assertEqual(self.client.get("/api/expense-summary/", {"month": "2026-10"}).status_code, 403)
