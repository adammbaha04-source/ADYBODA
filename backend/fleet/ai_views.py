import json
import os
import urllib.error
import urllib.request

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Modeli: unaweza kubadilisha bila kugusa code kwa kuweka AI_MODEL kwenye Render.
PRIMARY_MODEL = os.environ.get("AI_MODEL", "openai/gpt-oss-120b")
FALLBACK_MODEL = os.environ.get("AI_FALLBACK_MODEL", "openai/gpt-oss-20b")

MAX_REPORT_CHARS = 12000

SYSTEM_PROMPT = (
    "Wewe ni mchambuzi wa fedha wa biashara ya bajaji nchini Tanzania. "
    "Jibu kwa Kiswahili rahisi, kwa vitone visivyozidi 6, kila kitone kifupi. "
    "Tumia namba zilizotolewa tu. Usibuni namba wala tarehe mpya. "
    "Eleza: hali ya mapato dhidi ya target, gari lenye tatizo zaidi, siku zilizopotea na sababu zake, "
    "deni, gharama kubwa, kisha hatua 2 za kuchukua mwezi ujao."
)


class AiThrottle(UserRateThrottle):
    """Kila owner anaweza kuomba uchambuzi wa AI mara 10 kwa saa (rate 'ai' kwenye settings)."""
    scope = "ai"


def _call_groq(api_key, model, report_text):
    """Tuma ombi kwa Groq na kurudisha maandishi au kutupa HTTPError."""
    payload = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": 700,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Ripoti ya mwezi (JSON):\n{report_text}"},
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
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


class InsightsView(APIView):
    """POST /api/ai/insights/ with {"report": {...}}. Owner only."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [AiThrottle]

    def post(self, request):
        if hasattr(request.user, "membership"):
            return Response(
                {"detail": "Owner pekee ndiye anaweza kutumia uchambuzi wa AI."},
                status=status.HTTP_403_FORBIDDEN,
            )

        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if not api_key:
            return Response(
                {"detail": "AI haijawekwa. Weka GROQ_API_KEY kwenye Render."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        report = request.data.get("report")
        if not isinstance(report, dict) or not report:
            return Response(
                {"detail": "Ripoti haijatumwa."}, status=status.HTTP_400_BAD_REQUEST
            )

        report_text = json.dumps(report, ensure_ascii=False)[:MAX_REPORT_CHARS]

        for model in (PRIMARY_MODEL, FALLBACK_MODEL):
            try:
                text = _call_groq(api_key, model, report_text)
                return Response({"insights": text, "model": model})
            except urllib.error.HTTPError as e:
                # Usiweke body ya jibu kwenye logs: inaweza kuwa na taarifa za fedha.
                print("GROQ_ERROR", e.code, model, flush=True)
                continue
            except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError) as e:
                print("GROQ_ERROR", type(e).__name__, model, flush=True)
                continue

        return Response(
            {"detail": "Uchambuzi wa AI haukupatikana kwa sasa. Jaribu tena."},
            status=status.HTTP_502_BAD_GATEWAY,
        )
