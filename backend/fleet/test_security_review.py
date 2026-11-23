from datetime import date
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from fleet.models import Vehicle, Membership, DriverPeriod


class SecurityReviewTests(TestCase):
    def setUp(self):
        U = get_user_model()
        self.owner = U.objects.create_user("owner@x.com", password="secret123")
        self.other_owner = U.objects.create_user("other@x.com", password="secret123")
        self.vehicle = Vehicle.objects.create(owner=self.owner, name="B1", daily_target=10000)
        self.other_vehicle = Vehicle.objects.create(owner=self.other_owner, name="B2", daily_target=10000)
        self.driver = U.objects.create_user("driver1", password="secret123")
        self.drv_m = Membership.objects.create(user=self.driver, business_owner=self.owner, role="driver")
        self.drv_m.vehicles.set([self.vehicle])
        self.manager = U.objects.create_user("mgr", password="secret123")
        self.mgr_m = Membership.objects.create(user=self.manager, business_owner=self.owner, role="manager")
        self.mgr_m.vehicles.set([self.vehicle])
        DriverPeriod.objects.create(vehicle=self.vehicle, driver_name="Old Driver", from_date=date(2026, 1, 1),
                                    email="old@x.com", residence="Mtaa X", guarantor_name="Mdhamini",
                                    guarantor_phone="0712000000", phone="0755000000")
        self.tok = {u: Token.objects.create(user=u) for u in (self.owner, self.driver, self.manager)}

    def client_as(self, user):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Token {self.tok[user].key}")
        return c

    PRIVATE = ("email", "residence", "guarantor_name", "guarantor_phone")

    def test_driver_cannot_see_private_driver_fields_via_driver_periods(self):
        r = self.client_as(self.driver).get("/api/driver-periods/")
        self.assertEqual(r.status_code, 200)
        for row in r.json()["results"] if isinstance(r.json(), dict) and "results" in r.json() else r.json():
            for f in self.PRIVATE:
                self.assertNotIn(f, row)

    def test_driver_cannot_see_private_driver_fields_via_vehicles(self):
        r = self.client_as(self.driver).get("/api/vehicles/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        periods = rows[0]["driver_periods"]
        self.assertTrue(periods)
        for p in periods:
            for f in self.PRIVATE:
                self.assertNotIn(f, p)

    def test_owner_still_sees_full_driver_fields(self):
        r = self.client_as(self.owner).get("/api/vehicles/")
        body = r.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        self.assertIn("guarantor_phone", rows[0]["driver_periods"][0])

    def test_manager_cannot_change_vehicle_owner(self):
        c = self.client_as(self.manager)
        r = c.patch(f"/api/vehicles/{self.vehicle.id}/", {"owner": self.other_owner.id, "name": "B1x"}, format="json")
        self.assertIn(r.status_code, (200, 204))
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.owner_id, self.owner.id)

    def test_report_vehicle_must_belong_to_owner(self):
        r = self.client_as(self.owner).get(f"/api/reports/?from=2026-01&to=2026-02&vehicle={self.other_vehicle.id}")
        self.assertEqual(r.status_code, 404)

    def test_bad_month_is_400_not_500(self):
        r = self.client_as(self.owner).get("/api/personal-expenses/?month=abcd-xx")
        self.assertEqual(r.status_code, 400)

    def test_logout_revokes_token(self):
        c = self.client_as(self.driver)
        self.assertEqual(c.post("/api/auth/logout/").status_code, 204)
        self.assertFalse(Token.objects.filter(user=self.driver).exists())
        self.assertEqual(self.client_as(self.driver).get("/api/me/").status_code, 401)

    def test_password_change_revokes_tokens(self):
        r = self.client_as(self.owner).patch(f"/api/team/{self.drv_m.id}/", {"password": "newpass123"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(Token.objects.filter(user=self.driver).exists())
        self.assertEqual(self.client_as(self.driver).get("/api/me/").status_code, 401)

    def test_me_endpoint_works(self):
        r = self.client_as(self.driver).get("/api/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["role"], "driver")

    def test_ai_chart_has_throttle(self):
        from fleet.ai_chart_views import ChartView
        from fleet.ai_views import AiThrottle
        self.assertIn(AiThrottle, ChartView.throttle_classes)
