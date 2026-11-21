"""Groq tool-calling orchestration for AdyBoda ChartBot."""
import json
import os
import urllib.error
import urllib.request
from django.utils import timezone
from zoneinfo import ZoneInfo
from rest_framework.exceptions import APIException
from fleet.ai_schemas import TOOLS
from fleet.ai_tools import execute_tool

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
PRIMARY_MODEL = os.environ.get("AI_MODEL", "openai/gpt-oss-120b")
FALLBACK_MODEL = os.environ.get("AI_FALLBACK_MODEL", "openai/gpt-oss-20b")
MAX_TOOL_ROUNDS = 5
MAX_TOOL_OUTPUT_CHARS = 14000

SYSTEM_PROMPT = """Wewe ni AdyBoda AI Analyst, mchambuzi wa biashara ya bajaji Tanzania.
Jibu kwa Kiswahili rahisi isipokuwa mtumiaji atumie Kiingereza. Unaweza kutumia tools ulizopewa kutafuta data halisi.
Sheria muhimu:
- Usibuni takwimu, majina, tarehe, au matukio. Tumia tu matokeo ya tools.
- Ikiwa taarifa haipo au tool haijarudisha rekodi, sema wazi.
- Tofautisha jumla ya rekodi zilizorudishwa na jumla ya rekodi zote ikiwa kuna pagination/limit.
- Usidai kuwa umetafuta database ikiwa hukuitumia tool.
- Usitoe taarifa za gari/biashara nyingine; backend imeweka scope ya ruhusa.
- Toa uchambuzi, sababu zinazoungwa mkono na data, na hatua zinazotekelezeka.
- Mwisho rudisha JSON PEKEE: {"text":"jibu la Kiswahili","chart":null au {"type":"bar|line|pie|doughnut","title":"...","labels":["..."],"datasets":[{"label":"...","data":[namba]}]}}.
- Chati iwepo tu pale data ya tools inaunga mkono chati. Data za chart ziwe namba halisi zilizopatikana.
"""


def _request_groq(api_key, model, messages):
    payload = {"model": model, "temperature": 0.2, "max_tokens": 2200,
               "messages": messages, "tools": TOOLS, "tool_choice": "auto"}
    req = urllib.request.Request(GROQ_URL, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}",
                 "User-Agent": "AdyBoda/2.0"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def _clean_result(content):
    content = (content or "").strip()
    # Support JSON object returned inside markdown fences, while preferring strict JSON.
    if content.startswith("```"):
        content = content.strip("`")
        if content.lower().startswith("json"):
            content = content[4:].strip()
    try:
        obj = json.loads(content)
        if isinstance(obj, dict) and isinstance(obj.get("text"), str):
            chart = obj.get("chart")
            if chart is not None:
                if not isinstance(chart, dict) or chart.get("type") not in ("bar", "line", "pie", "doughnut"):
                    chart = None
                else:
                    labels = chart.get("labels", [])
                    datasets = chart.get("datasets", [])
                    if not isinstance(labels, list) or not isinstance(datasets, list) or len(labels) > 30:
                        chart = None
                    else:
                        valid = []
                        for ds in datasets[:5]:
                            values = ds.get("data", []) if isinstance(ds, dict) else []
                            if isinstance(values, list) and len(values) == len(labels) and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values):
                                valid.append({"label": str(ds.get("label", "Series"))[:80], "data": values})
                        chart = {"type": chart["type"], "title": str(chart.get("title", ""))[:120], "labels": [str(x)[:80] for x in labels], "datasets": valid} if valid else None
            return {"text": obj["text"][:8000], "chart": chart}
    except (ValueError, TypeError):
        pass
    return {"text": content[:8000] or "Samahani, sijapata jibu.", "chart": None}


def ask_adyboda(user, question):
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        raise APIException("AI haijawekwa. Weka GROQ_API_KEY kwenye Render.")
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + f"\nTarehe ya leo Tanzania: {timezone.now().astimezone(ZoneInfo('Africa/Dar_es_Salaam')).date().isoformat()}."},
        {"role": "user", "content": question[:2000]},
    ]
    last_error = None
    for model in dict.fromkeys([PRIMARY_MODEL, FALLBACK_MODEL]):
        try:
            for _ in range(MAX_TOOL_ROUNDS):
                data = _request_groq(api_key, model, messages)
                message = data["choices"][0]["message"]
                tool_calls = message.get("tool_calls") or []
                if not tool_calls:
                    return {"result": _clean_result(message.get("content")), "model": model}
                messages.append(message)
                for call in tool_calls:
                    fn = call.get("function", {})
                    name = fn.get("name", "")
                    try:
                        args = json.loads(fn.get("arguments") or "{}")
                        result = execute_tool(name, user, args)
                        tool_content = json.dumps(result, ensure_ascii=False, default=str)[:MAX_TOOL_OUTPUT_CHARS]
                    except Exception as exc:
                        # Return a safe tool error to the model; do not expose SQL or stack traces.
                        tool_content = json.dumps({"error": str(exc)[:300]}, ensure_ascii=False)
                    messages.append({"role": "tool", "tool_call_id": call.get("id"), "content": tool_content})
            # Ask for a final answer after the tool-call budget is reached.
            messages.append({"role": "user", "content": "Toa hitimisho sasa kwa kutumia matokeo ya tools yaliyopo. Usitume tool nyingine."})
            data = _request_groq(api_key, model, messages)
            return {"result": _clean_result(data["choices"][0]["message"].get("content")), "model": model}
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "ignore")[:300]
            print("GROQ_HTTP_ERROR", exc.code, model, body, flush=True)
            last_error = exc
        except Exception as exc:
            print("GROQ_ERROR", type(exc).__name__, str(exc)[:300], flush=True)
            last_error = exc
    raise APIException("Uchambuzi wa AI haukupatikana kwa sasa. Jaribu tena.") from last_error
