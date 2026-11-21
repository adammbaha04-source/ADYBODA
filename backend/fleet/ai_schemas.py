"""Groq/OpenAI-compatible function schemas for read-only AdyBoda analytics."""

DATE = {"type": "string", "description": "Tarehe YYYY-MM-DD. Hiari; ikiwa haipo tumia leo."}
RANGE_PROPS = {
    "date_from": {"type": "string", "description": "Tarehe ya kuanzia YYYY-MM-DD."},
    "date_to": {"type": "string", "description": "Tarehe ya mwisho YYYY-MM-DD."},
}

TOOLS = [
    {"type": "function", "function": {"name": "get_today_challenges", "description": "Pata changamoto zilizoripotiwa leo kwenye magari ambayo mtumiaji anaruhusiwa kuona.", "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_today_services", "description": "Pata service zilizorekodiwa leo kwenye magari yanayoonekana kwa mtumiaji.", "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_services", "description": "Chambua service kwa kipindi cha tarehe. Usizidi siku 366.", "parameters": {"type": "object", "properties": RANGE_PROPS, "required": ["date_from", "date_to"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_income_summary", "description": "Jumla ya marejesho ya mapato yaliyorekodiwa kwa kipindi cha tarehe.", "parameters": {"type": "object", "properties": RANGE_PROPS, "required": ["date_from", "date_to"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_payments_summary", "description": "Malipo ya TRA, maegesho, faini, polisi na malipo ya deni kwa kipindi.", "parameters": {"type": "object", "properties": RANGE_PROPS, "required": ["date_from", "date_to"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_open_challenges", "description": "Pata changamoto ambazo bado hazijatatuliwa.", "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_vehicle_overview", "description": "Pata orodha ya magari yanayoonekana kwa mtumiaji, target ya siku na dereva wa sasa ikiwa anapatikana.", "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_personal_expenses", "description": "Pata matumizi binafsi ya mmiliki kwa kipindi. Owner pekee; manager/driver hawaruhusiwi.", "parameters": {"type": "object", "properties": RANGE_PROPS, "required": ["date_from", "date_to"], "additionalProperties": False}}},
]
