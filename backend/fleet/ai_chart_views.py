import json
import os
import urllib.error
import urllib.request

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
PRIMARY_MODEL = os.environ.get("AI_MODEL", "openai/gpt-oss-120b")
FALLBACK_MODEL = os.environ.get("AI_FALLBACK_MODEL", "openai/gpt-oss-20b")
MAX_REPORT_CHARS = 12000

SYSTEM_PROMPT = (
    "Wewe ni mshauri mkuu wa kiufundi na mchambuzi wa fedha wa kampuni ya bajaji Tanzania. "
    "Mtumiaji atakupa swali na data ya ripoti kwa JSON. "
    "Kazi yako ni kuchambua data hiyo na kutoa majibu ya kitaalamu (professional insights). "
    "Kama swali linahusu 'Service', 'Matengenezo', 'Matairi' au 'Bima', chambua gharama hizo kwa kina, "
    "toa ushauri wa kiufundi (mfano: gari gani linahitaji matengenezo zaidi, au hali ya matairi ikoje). "
    "Jibu KWA JSON PEKEE (hakuna maandishi mengine) yenye muundo huu: "
    '{"type": "bar" au "line" au "pie" au "doughnut", '
    '"title": "Kichwa kifupi cha chati", '
    '"labels": ["...", "..."], '
    '"datasets": [{"label": "Jina la data", "data": [namba, namba, ...]}]}. '
    "Chagua aina ya chart inayofaa swali (mfano pie kwa gharama za service, bar kwa kulinganisha magari). "
    "Tumia namba halisi kutoka data tu. Usibuni namba mpya."
)


def _call_groq(api_key, model, question, report_text):
    """Tuma ombi kwa Groq na kurudisha JSON ya chart."""
    payload = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": 900,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Swali: {question}\n\nData (JSON):\n{report_text}"},
        ],
    }
    req = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "AdyBajaj/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    text = data["choices"][0]["message"]["content"].strip()
    return json.loads(text)


class ChartView(APIView):
    """POST /api/ai/chart/ with {"question": "...", "report": {...}}. Owner only."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if hasattr(request.user, "membership"):
            return Response(
                {"detail": "Owner pekee ndiye anaweza kutumia AI."},
                status=status.HTTP_403_FORBIDDEN,
            )

        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if not api_key:
            return Response(
                {"detail": "AI haijawekwa. Weka GROQ_API_KEY kwenye Render."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        question = (request.data.get("question") or "").strip()
        report = request.data.get("report")

        if not question:
            return Response(
                {"detail": "Tuma swali (question)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(report, dict) or not report:
            return Response(
                {"detail": "Tuma data ya ripoti (report)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report_text = json.dumps(report, ensure_ascii=False)[:MAX_REPORT_CHARS]

        for model in (PRIMARY_MODEL, FALLBACK_MODEL):
            try:
                chart = _call_groq(api_key, model, question, report_text)
                return Response({"chart": chart, "model": model})
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", "ignore")[:300]
                print("GROQ_CHART_ERROR", e.code, model, body, flush=True)
                continue
            except (
                urllib.error.URLError,
                TimeoutError,
                KeyError,
                IndexError,
                ValueError,
                json.JSONDecodeError,
            ) as e:
                print("GROQ_CHART_ERROR", type(e).__name__, model, e, flush=True)
                continue

        return Response(
            {"detail": "Uchambuzi haukupatikana. Jaribu tena."},
            status=status.HTTP_502_BAD_GATEWAY,
        )
