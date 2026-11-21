import os
from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APITestCase

from fleet import ai_service, ai_tools
from fleet.models import Vehicle, Membership, Return, ServiceRecord, Challenge, PersonalExpense

User = get_user_model()


class AiToolsScopeTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("aiboss", password="x")
        self.other = User.objects.create_user("aiboss2", password="x")
        self.v1 = Vehicle.objects.create(owner=self.owner, name="A1", daily_target=16000)
        self.v2 = Vehicle.objects.create(owner=self.owner, name="A2", daily_target=16000)
        self.foreign = Vehicle.objects.create(owner=self.other, name="F1", daily_target=16000)
        self.manager = User.objects.create_user("aimgr", password="x")
        m = Membership.objects.create(user=self.manager, business_owner=self.owner, role="manager")
        m.vehicles.set([self.v1])
        self.driver = User.objects.create_user("aidrv", password="x")
        d = Membership.objects.create(user=self.driver, business_owner=self.owner, role="driver")
        d.vehicles.set([self.v2])
        today = ai_tools._tanzania_today()
        ServiceRecord.objects.create(vehicle=self.v1, day=today, tool="Oil", count=2, unit_price=5000)
        ServiceRecord.objects.create(vehicle=self.v2, day=today, tool="Plug", count=1, unit_price=3000)
        ServiceRecord.objects.create(vehicle=self.foreign, day=today, tool="Secret", count=1, unit_price=9999)
        Return.objects.create(vehicle=self.v1, day=date(2026, 10, 5), amount=16000)
        Return.objects.create(vehicle=self.foreign, day=date(2026, 10, 5), amount=99999)
        Challenge.objects.create(vehicle=self.v1, title="Tairi", description="Imepasuka")
        PersonalExpense.objects.create(owner=self.owner, day=date(2026, 10, 5), category="chakula", amount=7000)

    def test_owner_services_exclude_other_business(self):
        out = ai_tools.execute_tool("get_today_services", self.owner, {})
        self.assertEqual(out["count"], 2)
        self.assertEqual(out["total_tzs"], 13000)

    def test_manager_sees_only_assigned_vehicle(self):
        out = ai_tools.execute_tool("get_today_services", self.manager, {})
        self.assertEqual(out["count"], 1)
        self.assertEqual(out["items"][0]["vehicle"], "A1")

    def test_income_summary_is_scoped(self):
        args = {"date_from": "2026-10-01", "date_to": "2026-10-31"}
        out = ai_tools.execute_tool("get_income_summary", self.owner, args)
        self.assertEqual(out["total_collected_tzs"], 16000)

    def test_open_challenges_returned(self):
        out = ai_tools.execute_tool("get_open_challenges", self.owner, {})
        self.assertEqual(out["open_count"], 1)

    def test_vehicle_overview_lists_only_visible(self):
        out = ai_tools.execute_tool("get_vehicle_overview", self.driver, {})
        self.assertEqual([x["vehicle"] for x in out["items"]], ["A2"])

    def test_personal_expenses_owner_only(self):
        args = {"date_from": "2026-10-01", "date_to": "2026-10-31"}
        out = ai_tools.execute_tool("get_personal_expenses", self.owner, args)
        self.assertEqual(out["total_expenses_tzs"], 7000)
        with self.assertRaises(PermissionDenied):
            ai_tools.execute_tool("get_personal_expenses", self.manager, args)
        with self.assertRaises(PermissionDenied):
            ai_tools.execute_tool("get_personal_expenses", self.driver, args)

    def test_bad_dates_and_unknown_tool_rejected(self):
        with self.assertRaises(ValidationError):
            ai_tools.execute_tool("get_services", self.owner, {"date_from": "abc", "date_to": "2026-10-01"})
        with self.assertRaises(ValidationError):
            ai_tools.execute_tool("get_services", self.owner, {"date_from": "2026-10-10", "date_to": "2026-10-01"})
        with self.assertRaises(ValueError):
            ai_tools.execute_tool("drop_database", self.owner, {})


class AiChartViewTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("aichart", password="x")
        Vehicle.objects.create(owner=self.owner, name="C1", daily_target=16000)
        self.client.force_authenticate(self.owner)

    def test_empty_question_is_400(self):
        r = self.client.post("/api/ai/chart/", {"question": "   "}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_too_long_question_is_400(self):
        r = self.client.post("/api/ai/chart/", {"question": "a" * 2001}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_requires_login(self):
        self.client.force_authenticate(None)
        r = self.client.post("/api/ai/chart/", {"question": "Habari"}, format="json")
        self.assertIn(r.status_code, (401, 403))

    def test_missing_api_key_gives_clear_error(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}):
            r = self.client.post("/api/ai/chart/", {"question": "Habari"}, format="json")
        self.assertEqual(r.status_code, 500)
        self.assertIn("GROQ_API_KEY", r.data["detail"])

    def test_tool_call_then_final_answer(self):
        tool_reply = {"choices": [{"message": {"role": "assistant", "content": None, "tool_calls": [
            {"id": "c1", "type": "function", "function": {"name": "get_vehicle_overview", "arguments": "{}"}}]}}]}
        final_reply = {"choices": [{"message": {"role": "assistant",
                                                "content": '{"text": "Una gari moja.", "chart": null}'}}]}
        with patch.dict(os.environ, {"GROQ_API_KEY": "test"}), \
             patch.object(ai_service, "_request_groq", side_effect=[tool_reply, final_reply]) as mocked:
            r = self.client.post("/api/ai/chart/", {"question": "Nina magari mangapi?"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["result"]["text"], "Una gari moja.")
        self.assertIsNone(r.data["result"]["chart"])
        self.assertEqual(mocked.call_count, 2)

    def test_groq_failure_gives_clean_error(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": "test"}), \
             patch.object(ai_service, "_request_groq", side_effect=RuntimeError("boom")):
            r = self.client.post("/api/ai/chart/", {"question": "Habari"}, format="json")
        self.assertEqual(r.status_code, 500)
        self.assertIn("haukupatikana", r.data["detail"])


class CleanResultTests(APITestCase):
    def test_valid_chart_kept(self):
        raw = '{"text":"ok","chart":{"type":"bar","title":"T","labels":["a","b"],"datasets":[{"label":"x","data":[1,2]}]}}'
        out = ai_service._clean_result(raw)
        self.assertEqual(out["chart"]["type"], "bar")
        self.assertEqual(out["chart"]["datasets"][0]["data"], [1, 2])

    def test_bad_chart_dropped(self):
        raw = '{"text":"ok","chart":{"type":"radar","labels":["a"],"datasets":[]}}'
        self.assertIsNone(ai_service._clean_result(raw)["chart"])

    def test_mismatched_data_dropped(self):
        raw = '{"text":"ok","chart":{"type":"line","labels":["a","b"],"datasets":[{"label":"x","data":[1]}]}}'
        self.assertIsNone(ai_service._clean_result(raw)["chart"])

    def test_plain_text_fallback(self):
        out = ai_service._clean_result("Habari tu")
        self.assertEqual(out["text"], "Habari tu")
        self.assertIsNone(out["chart"])
