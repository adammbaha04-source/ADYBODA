from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from fleet.models import Vehicle, Membership, Challenge

User = get_user_model()


class ProfileAndChallengeTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("own", password="x")
        self.v = Vehicle.objects.create(owner=self.owner, name="C1", daily_target=16000, working_days_count=6)
        self.v2 = Vehicle.objects.create(owner=self.owner, name="C2", daily_target=16000, working_days_count=6)
        self.mgr_u = User.objects.create_user("mg", password="x")
        self.mgr = Membership.objects.create(user=self.mgr_u, business_owner=self.owner, role="manager")
        self.mgr.vehicles.set([self.v])
        self.drv_u = User.objects.create_user("dv", password="x")
        self.drv = Membership.objects.create(user=self.drv_u, business_owner=self.owner, role="driver")
        self.drv.vehicles.set([self.v])

    def test_driver_reports_and_sees_resolved_after_owner_solves(self):
        self.client.force_authenticate(self.drv_u)
        r = self.client.post("/api/challenges/", {"vehicle": self.v.id, "title": "Breki", "description": "Breki mbovu"}, format="json")
        self.assertEqual(r.status_code, 201)
        cid = r.data["id"]
        self.assertEqual(r.data["status"], "open")
        r = self.client.post(f"/api/challenges/{cid}/solve/")
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.owner)
        r = self.client.post(f"/api/challenges/{cid}/solve/")
        self.assertEqual(r.status_code, 200)
        self.client.force_authenticate(self.drv_u)
        r = self.client.get("/api/challenges/")
        self.assertEqual(r.data[0]["status"], "resolved")

    def test_manager_can_solve_assigned_vehicle_only(self):
        ch = Challenge.objects.create(vehicle=self.v, created_by=self.drv_u, title="Taa")
        self.client.force_authenticate(self.mgr_u)
        self.assertEqual(self.client.post(f"/api/challenges/{ch.id}/solve/").status_code, 200)
        other = Challenge.objects.create(vehicle=self.v2, created_by=self.owner, title="X")
        self.assertEqual(self.client.post(f"/api/challenges/{other.id}/solve/").status_code, 404)

    def test_driver_cannot_report_on_other_vehicle(self):
        self.client.force_authenticate(self.drv_u)
        r = self.client.post("/api/challenges/", {"vehicle": self.v2.id, "title": "Hapana"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_profile_edit_and_settings(self):
        self.client.force_authenticate(self.drv_u)
        r = self.client.patch("/api/me/", {"full_name": "Hamis Juma", "phone": "0655154442",
                                           "theme": "dark", "background": "ocean", "accent": "#0ea5e9"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["full_name"], "Hamis Juma")
        self.assertEqual(r.data["theme"], "dark")
        r = self.client.patch("/api/me/", {"background": "nope"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.patch("/api/me/", {"avatar": "data:image/png;base64,AAAA"}, format="json")
        self.assertEqual(r.status_code, 200)
        r = self.client.patch("/api/me/", {"avatar": "http://x"}, format="json")
        self.assertEqual(r.status_code, 400)
