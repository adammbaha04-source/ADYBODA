import json
import os
import urllib.error
import urllib.request

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.environ.get("AI_MODEL", "llama-3.3-70b-versatile")
MAX_REPORT_CHARS = 12000

SYSTEM_PROMPT = (
    "Wewe ni mchambuzi wa fedha wa biashara ya bajaji nchini Tanzania. "
    "Jibu kwa Kiswahili rahisi, kwa vitone visivyozidi 6, kila kitone kifupi. "
    "Tumia namba zilizotolewa tu. Usibuni namba wala tarehe mpya. "
    "Eleza: hali ya mapato dhidi ya target, gari lenye tatizo zaidi, siku zilizopotea na sababu zake, "
    "deni, gharama kubwa, kisha hatua 2 za kuchukua mwezi ujao."
)


class InsightsView(APIView):
    """POST /api/ai/insights/ with {"report": {...}}. Owner only."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Manager and driver accounts have a Membership row. Only the owner may use AI analysis.
        if hasattr(request.user, "membership"):
            return Response({"detail": "Owner pekee ndiye anaweza kutumia uchambuzi wa AI."},
                            status=status.HTTP_403_FORBIDDEN)

        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if not api_key:
            return Response({"detail": "AI haijawekwa. Weka GROQ_API_KEY kwenye Render."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        report = request.data.get("report")
        if not isinstance(report, dict) or not report:
            return Response({"detail": "Ripoti haijatumwa."}, status=status.HTTP_400_BAD_REQUEST)

        report_text = json.dumps(report, ensure_ascii=False)[:MAX_REPORT_CHARS]
        payload = {
            "model": MODEL,
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
                # Groq's edge blocks the default Python user agent.
                "User-Agent": "AdyBajaj/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            text = data["choices"][0]["message"]["content"].strip()
        except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError):
            return Response({"detail": "Uchambuzi wa AI haukupatikana kwa sasa. Jaribu tena."},
                            status=status.HTTP_502_BAD_GATEWAY)

        return Response({"insights": text, "model": MODEL})
