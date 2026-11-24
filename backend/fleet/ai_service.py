"""Groq tool-calling orchestration for AdyBoda ChartBot."""
import json
import os
import re
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
MAX_CHARTS = 3
CHART_TYPES = ("bar", "line", "pie", "doughnut", "halfpie")

SYSTEM_PROMPT = """Wewe ni AdyBoda AI Analyst, mchambuzi mtaalamu wa biashara ya bajaji Tanzania.
Jibu kwa Kiswahili rahisi isipokuwa mtumiaji atumie Kiingereza.

KUCHAGUA TOOL (tumia data halisi kila mara):
- matumizi binafsi -> get_personal_expenses
- service, matairi, vipuri, mafuta ya injini, vitu vilivyonunuliwa -> get_services
- mapato / marejesho -> get_income_summary
- malipo (TRA, maegesho, faini, polisi, deni) -> get_payments_summary
- changamoto -> get_open_challenges / get_today_challenges
- magari na madereva -> get_vehicle_overview
Ikiwa swali linahusu zaidi ya kitu kimoja (mfano faida), tumia tools kadhaa.
Tools zinarudisha jumla tayari (totals_by_category, totals_by_item, totals_by_type, totals_by_vehicle, totals_by_month) zikiwa na asilimia. Tumia jumla hizo; usizihesabu upya kutoka kwenye items.
"mwezi huu" = kuanzia tarehe 1 ya mwezi wa sasa hadi leo. "mwezi uliopita" = mwezi mzima uliopita.

MUUNDO WA UCHAMBUZI (wa kitaalamu):
1. Muhtasari: jumla kuu kwa TZS na kipindi.
2. Mgawanyo kwa item/kundi: taja kila kundi kubwa na kiasi na asilimia yake, kuanzia kubwa hadi ndogo.
3. Mwenendo: ikiwa kuna miezi zaidi ya mmoja, onyesha kupanda au kushuka.
4. Ushauri: taja gharama zipi zipunguzwe au zifuatiliwe, kwa nini (kwa kutumia asilimia na kiasi), na makadirio ya kiasi kinachoweza kuokolewa. Eleza pia kilicho sawa.
5. Hatua 2 hadi 3 zinazotekelezeka.
Tumia **maneno mazito** kwa vichwa na namba muhimu. Andika kiasi kama TZS 125,000.

CHATI:
- Tengeneza chati 1 hadi 3 zinazounga mkono uchambuzi: pie au doughnut kwa mgawanyo, bar kwa ulinganisho, line kwa mwenendo wa miezi.
- Mtumiaji akitaja aina ya chati (pie, half chart, half pie, line, bar), tumia aina hiyo. "half chart" / "half pie" = aina "halfpie".
- Aina zinazoruhusiwa: bar, line, pie, doughnut, halfpie.
- Data za chati ziwe namba halisi kutoka kwenye tools. Usibuni.

SHERIA:
- Usibuni takwimu, majina, tarehe, au matukio. Tumia tu matokeo ya tools.
- Ikiwa taarifa haipo au tool haijarudisha rekodi, sema wazi.
- Tofautisha jumla ya rekodi zilizorudishwa (items) na jumla ya rekodi zote (total_records) ikiwa kuna limit.
- Usidai kuwa umetafuta database ikiwa hukuitumia tool.
- Usitoe taarifa za gari/biashara nyingine; backend imeweka scope ya ruhusa.
- Ushauri uungwe mkono na data; usitoe ushauri wa jumla usio na ushahidi.

MUUNDO WA JIBU LA MWISHO: rudisha kitu kimoja tu, JSON object. Uchambuzi WOTE (muhtasari, mgawanyo, mwenendo, ushauri, hatua) uandikwe ndani ya sehemu ya "text". Usiandike maandishi yoyote nje ya JSON, wala ```.
Umbo: {"text": <uchambuzi kamili kwa Kiswahili>, "charts": [ {"type": <bar|line|pie|doughnut|halfpie>, "title": <kichwa>, "labels": [<majina>], "datasets": [ {"label": <jina>, "data": [<namba>]} ]} ]}
Ikiwa hakuna chati inayofaa, tumia "charts": [].
"""


def _request_groq(api_key, model, messages):
    payload = {"model": model, "temperature": 0.2, "max_tokens": 3000,
               "messages": messages, "tools": TOOLS, "tool_choice": "auto"}
    req = urllib.request.Request(GROQ_URL, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}",
                 "User-Agent": "AdyBoda/2.0"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def _clean_chart(chart):
    """Validate one chart object; return a safe chart dict or None."""
    if not isinstance(chart, dict) or chart.get("type") not in CHART_TYPES:
        return None
    labels = chart.get("labels", [])
    datasets = chart.get("datasets", [])
    if not isinstance(labels, list) or not isinstance(datasets, list) or len(labels) > 30:
        return None
    valid = []
    for ds in datasets[:5]:
        values = ds.get("data", []) if isinstance(ds, dict) else []
        if isinstance(values, list) and len(values) == len(labels) and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values):
            valid.append({"label": str(ds.get("label", "Series"))[:80], "data": values})
    if not valid:
        return None
    return {"type": chart["type"], "title": str(chart.get("title", ""))[:120],
            "labels": [str(x)[:80] for x in labels], "datasets": valid}


def _find_json(content):
    """Return (object, leftover_text). Handles pure JSON, fenced JSON, or JSON after prose."""
    try:
        obj = json.loads(content)
        if isinstance(obj, dict):
            return obj, ""
    except (ValueError, TypeError):
        pass
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", content, re.S)
    if m:
        try:
            obj = json.loads(m.group(1))
            if isinstance(obj, dict):
                return obj, content[:m.start()] + content[m.end():]
        except (ValueError, TypeError):
            pass
    start, end = content.find("{"), content.rfind("}")
    if start != -1 and end > start:
        try:
            obj = json.loads(content[start:end + 1])
            if isinstance(obj, dict):
                return obj, content[:start] + content[end + 1:]
        except (ValueError, TypeError):
            pass
    return None, content


def _clean_result(content):
    content = (content or "").strip()
    obj, rest = _find_json(content)
    if obj is not None and ("charts" in obj or "chart" in obj or isinstance(obj.get("text"), str)):
        raw_charts = obj.get("charts")
        if not isinstance(raw_charts, list):
            raw_charts = [obj.get("chart")] if obj.get("chart") is not None else []
        charts = [c for c in (_clean_chart(x) for x in raw_charts[:MAX_CHARTS]) if c]
        obj_text = obj["text"] if isinstance(obj.get("text"), str) else ""
        # If the model wrote the analysis outside the JSON, keep that and drop a dangling "Chati" heading.
        rest = re.sub(r"\s*(?:\*\*)?Chati(?:\*\*)?\s*:?\s*$", "", rest.strip(), flags=re.I).strip()
        text = rest if len(rest) >= 40 else (obj_text or rest)
        # "chart" (first chart) is kept so older screens keep working.
        return {"text": (text or "Samahani, sijapata jibu.")[:8000],
                "chart": charts[0] if charts else None, "charts": charts}
    return {"text": content[:8000] or "Samahani, sijapata jibu.", "chart": None, "charts": []}


def ask_adyboda(user, question):
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        raise APIException("AI haijawekwa. Weka GROQ_API_KEY kwenye Render.")
    today = timezone.now().astimezone(ZoneInfo("Africa/Dar_es_Salaam")).date()
    month_start = today.replace(day=1)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + f"\nTarehe ya leo Tanzania: {today.isoformat()}. Mwezi huu: {month_start.isoformat()} hadi {today.isoformat()}."},
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
