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
    "Jibu KWA JSON PEKEE yenye muundo huu: "
    '{"text": "Maandishi yako ya uchambuzi na ushauri hapa (unaweza kutumia alama za **kukoleza** au - kwa orodha)", '
    '"chart": {"type": "bar" au "line" au "pie" au "doughnut", "title": "Kichwa", "labels": ["..."], "datasets": [{"label": "Jina", "data": [namba]}]} } '
    "Kama swali halihitaji chati (mfano: 'Nifanye nini kuongeza faida?'), weka 'chart': null. "
    "Tumia namba halisi kutoka data tu. Usibuni namba mpya."
)

def _call_groq(api_key, model, question, report_text):
    payload = {
        "model": model,
        "temperature": 0.3,
        "max_tokens": 1500,
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
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    text = data["choices"][0]["message"]["content"].strip()
    return json.loads(text)

class ChartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if hasattr(request.user, "membership"):
            return Response({"detail": "Owner pekee ndiye anaweza kutumia AI."}, status=status.HTTP_403_FORBIDDEN)

        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if not api_key:
            return Response({"detail": "AI haijawekwa."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        question = (request.data.get("question") or "").strip()
        report = request.data.get("report")

        if not question or not isinstance(report, dict):
            return Response({"detail": "Tuma swali na data ya ripoti."}, status=status.HTTP_400_BAD_REQUEST)

        report_text = json.dumps(report, ensure_ascii=False)[:MAX_REPORT_CHARS]

        for model in (PRIMARY_MODEL, FALLBACK_MODEL):
            try:
                result = _call_groq(api_key, model, question, report_text)
                return Response({"result": result, "model": model})
            except Exception as e:
                print("GROQ_ERROR", type(e).__name__, e, flush=True)
                continue

        return Response({"detail": "Uchambuzi haukupatikana. Jaribu tena."}, status=status.HTTP_502_BAD_GATEWAY)
