from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from fleet.models import Vehicle


class RegisterTests(APITestCase):
    def test_owner_registers_and_gets_token(self):
        r = self.client.post("/api/auth/register/", {"full_name": "Adam Mbaha", "business_name": "Ady Bajaj",
                                                     "phone": "0712345678", "email": "Adam@Mail.com",
                                                     "password": "secret1"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertIn("token", r.data)
        self.assertTrue(get_user_model().objects.filter(username="adam@mail.com").exists())
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        me = self.client.get("/api/me/").data
        self.assertEqual(me["role"], "owner")
        self.assertEqual(me["business_name"], "Ady Bajaj")
        v = self.client.post("/api/vehicles/", {"name": "NEW1", "daily_target": 16000, "working_days_count": 6}, format="json")
        self.assertEqual(v.status_code, 201)

    def test_duplicate_and_missing_fields_rejected(self):
        body = {"full_name": "A", "business_name": "B", "phone": "1", "email": "x@y.com", "password": "secret1"}
        self.assertEqual(self.client.post("/api/auth/register/", body, format="json").status_code, 201)
        self.assertEqual(self.client.post("/api/auth/register/", body, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/auth/register/", {"email": "z@z.com"}, format="json").status_code, 400)
