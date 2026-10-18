"""Downloadable PDF of a report (A4 landscape). Uses the dict produced by reports.build_report."""
from datetime import date
from functools import partial
from io import BytesIO

from reportlab.graphics.shapes import Drawing, Rect
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, KeepTogether)

from fleet.reports import MONTHS_SW

NAVY = colors.HexColor("#0f172a")
INDIGO = colors.HexColor("#4f46e5")
EMERALD = colors.HexColor("#059669")
RED = colors.HexColor("#dc2626")
AMBER = colors.HexColor("#d97706")
SLATE = colors.HexColor("#64748b")
LINE = colors.HexColor("#e2e8f0")
ZEBRA = colors.HexColor("#f8fafc")
TRACK = colors.HexColor("#e2e8f0")
PAGE_W, PAGE_H = landscape(A4)
MARGIN = 14 * mm
AVAIL = PAGE_W - 2 * MARGIN

S = {
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, spaceAfter=2),
    "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=9, leading=12, textColor=SLATE),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11.5, leading=14, textColor=NAVY,
                         spaceBefore=12, spaceAfter=6),
    "info": ParagraphStyle("info", fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#1e3a8a"),
                           backColor=colors.HexColor("#eff6ff"), borderPadding=(6, 6, 6, 6), spaceAfter=8),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=7.2, leading=8.6, textColor=NAVY),
    "cellr": ParagraphStyle("cellr", fontName="Helvetica", fontSize=7.2, leading=8.6, textColor=NAVY, alignment=TA_RIGHT),
    "head": ParagraphStyle("head", fontName="Helvetica-Bold", fontSize=6.8, leading=8, textColor=colors.white,
                           alignment=TA_CENTER),
    "kl": ParagraphStyle("kl", fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=SLATE),
    "kv": ParagraphStyle("kv", fontName="Helvetica-Bold", fontSize=14, leading=17, textColor=NAVY),
    "kp": ParagraphStyle("kp", fontName="Helvetica", fontSize=7.5, leading=9.5, textColor=SLATE),
    "note": ParagraphStyle("note", fontName="Helvetica", fontSize=7.5, leading=10, textColor=SLATE, spaceAfter=3),
}


def tsh(n) -> str:
    return f"TSh {round(n or 0):,}"


def neg(n) -> str:
    return f"({tsh(n)})" if n else tsh(0)


def pct(part, whole) -> float:
    return (part / whole * 100) if whole and whole > 0 else 0.0


def pct_txt(part, whole) -> str:
    return f"{pct(part, whole):.1f}%"


def tone(p: float):
    if p >= 90:
        return EMERALD
    if p >= 60:
        return AMBER
    return RED


def bar(width: float, p: float, color, h: float = 5):
    p = max(0.0, min(100.0, p))
    d = Drawing(width, h)
    d.add(Rect(0, 0, width, h, rx=h / 2, ry=h / 2, fillColor=TRACK, strokeColor=None))
    if p > 0:
        d.add(Rect(0, 0, max(h, width * p / 100), h, rx=h / 2, ry=h / 2, fillColor=color, strokeColor=None))
    return d


def _header_footer(canvas, doc, report):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 12 * mm, PAGE_W, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(MARGIN, PAGE_H - 8 * mm, (report["business_name"] or "AdyBajaj").upper())
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 8 * mm, f"{report['title']}: {report['subtitle']}")
    canvas.setFillColor(SLATE)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(MARGIN, 7 * mm, f"Imetolewa {report['generated']} · AdyBajaj · Ripoti ya kifedha")
    canvas.drawRightString(PAGE_W - MARGIN, 7 * mm, f"Ukurasa {doc.page}")
    canvas.restoreState()


def _table(rows, widths, header_rows=1, total=False):
    t = Table(rows, colWidths=widths, repeatRows=header_rows)
    style = [
        ("BACKGROUND", (0, 0), (-1, header_rows - 1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, header_rows), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(header_rows, len(rows)):
        if (i - header_rows) % 2 == 1:
            style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    if total:
        last = len(rows) - 1
        style += [("BACKGROUND", (0, last), (-1, last), colors.HexColor("#e0e7ff")),
                  ("LINEABOVE", (0, last), (-1, last), 1, NAVY)]
    t.setStyle(TableStyle(style))
    return t


def _kpi_card(label, value, caption, p, color, width):
    cell = [
        Paragraph(label.upper(), S["kl"]),
        Spacer(1, 3),
        Paragraph(value, S["kv"]),
        Spacer(1, 2),
        Paragraph(f"<font color='{color.hexval().replace('0x', '#')}'><b>{p:.1f}%</b></font> {caption}", S["kp"]),
        Spacer(1, 5),
        bar(width - 16, p, color),
    ]
    return cell


def build_pdf(report: dict) -> bytes:
    t = report["totals"]
    vehicles = report["vehicles"]
    single = report.get("single_month", False)
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=18 * mm, bottomMargin=14 * mm,
                            title=f"{report['title']} {report['subtitle']}", author=report["business_name"])
    story = []

    # --- title block -------------------------------------------------------
    f, to = report["from"], report["to"]
    if f == to:
        y, mo = int(f[:4]), int(f[5:7])
        period = f"{MONTHS_SW[mo - 1]} {y}"
    else:
        period = f"{f} hadi {to}"
    scope = report["vehicles"][0]["name"] if report.get("vehicle_id") and vehicles else "Magari yote"
    story.append(Paragraph(f"{report['title']}: {report['subtitle']}", S["h1"]))
    story.append(Paragraph(f"{report['business_name']} · Kipindi: {period} · Wigo: {scope}", S["sub"]))
    story.append(Spacer(1, 10))

    # --- KPI cards with percentages -----------------------------------------
    gap = 8
    cw = (AVAIL - 3 * gap) / 4
    profit_m = pct(t["profit"], t["collected"])
    kpis = [
        ("Income vs Target", tsh(t["collected"]), f"of target {tsh(t['target'])}",
         pct(t["collected"], t["target"]), EMERALD),
        ("Expenditure of Income", tsh(t["expenses"] + t["personal"]), "share of income",
         pct(t["expenses"] + t["personal"], t["collected"]), AMBER),
        ("Loss of Target", tsh(t["lost_amount"]), f"days lost: {t['lost_days']}",
         pct(t["lost_amount"], t["target"]), RED),
        ("Profit Margin", tsh(t["profit"]), "net profit of income", profit_m, EMERALD if t["profit"] >= 0 else RED),
    ]
    cards = [[_kpi_card(*k[:2], k[2], k[3], k[4], cw) for k in kpis]]
    kt = Table(cards, colWidths=[cw] * 4, hAlign="LEFT")
    kt.setStyle(TableStyle([
        ("BOX", (0, 0), (0, 0), 0.8, LINE), ("BOX", (1, 0), (1, 0), 0.8, LINE),
        ("BOX", (2, 0), (2, 0), 0.8, LINE), ("BOX", (3, 0), (3, 0), 0.8, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBEFORE", (1, 0), (1, 0), 0, colors.white),
    ]))
    story.append(kt)
    story.append(Spacer(1, 8))

    # second row: profit percentage cards
    pcards = [
        ("Gross margin (before loss)", pct(t["collected"] - t["expenses"] - t["personal"], t["collected"]),
         "(collected - expenses - personal) / collected", False),
        ("Net profit margin", profit_m, "profit / collected income", False),
        ("Collection rate", pct(t["collected"], t["target"]), "collected / target", False),
        ("Debt ratio", pct(t["outstanding"], t["target"]), "ending debt / target", True),
    ]
    prow = []
    for label, p, note, is_debt in pcards:
        col = RED if is_debt else tone(p)
        prow.append([Paragraph(label.upper(), S["kl"]), Spacer(1, 2),
                     Paragraph(f"{p:.1f}%", ParagraphStyle("pv", parent=S["kv"], fontSize=12, leading=14, textColor=col)),
                     Paragraph(note, S["kp"]), Spacer(1, 4), bar(cw - 16, p, col, 4)])
    pt = Table([prow], colWidths=[cw] * 4, hAlign="LEFT")
    pt.setStyle(TableStyle([
        ("BOX", (0, 0), (0, 0), 0.8, LINE), ("BOX", (1, 0), (1, 0), 0.8, LINE),
        ("BOX", (2, 0), (2, 0), 0.8, LINE), ("BOX", (3, 0), (3, 0), 0.8, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(pt)

    # --- Monthly Expenses by Category -------------------------------------
    exp_rows = [("Service", t["service"]), ("Tairi (Tyres)", t["tyres"]), ("Bima (Insurance)", t["insurance"]),
                ("Malipo mengine ya gari (TRA, maegesho, faini)", t["other_payments"])]
    exp_rows += [(f"Matumizi binafsi: {c['label']}", c["amount"]) for c in report["personal_categories"] if c["amount"] > 0]
    exp_rows = [r for r in exp_rows if r[1] > 0]
    exp_total = sum(a for _, a in exp_rows)
    rows = [[Paragraph("EXPENSE CATEGORY", S["head"]), Paragraph("AMOUNT", S["head"]),
             Paragraph("PERCENTAGE", S["head"]), Paragraph("SHARE", S["head"])]]
    for name, amt in exp_rows:
        p = pct(amt, exp_total)
        rows.append([Paragraph(name, S["cell"]), Paragraph(tsh(amt), S["cellr"]),
                     Paragraph(f"{p:.1f}%", S["cellr"]), bar(120, p, INDIGO, 5)])
    rows.append([Paragraph("<b>TOTAL</b>", S["cell"]), Paragraph(f"<b>{tsh(exp_total)}</b>", S["cellr"]),
                 Paragraph("<b>100.0%</b>", S["cellr"]), ""])
    ew = [AVAIL * 0.46, AVAIL * 0.18, AVAIL * 0.14]
    ew.append(AVAIL - sum(ew))
    story.append(KeepTogether([Paragraph("Monthly Expenses by Category", S["h2"]),
                               _table(rows, ew, total=True)]))

    # --- Vehicle Performance ----------------------------------------------
    story.append(Paragraph("Vehicle Performance", S["h2"]))
    if single:
        info = ("<b>Week dates:</b> Weekly income is the income recorded for each week of the month "
                "(excess is not counted). % Achieved = total income / monthly target.")
    else:
        info = ("<b>Period:</b> Income, debt and losses are summed across the whole period. "
                "% Achieved = total income / target of the period.")
    story.append(Paragraph(info, S["info"]))
    if single:
        maxw = max([v["week_count"] for v in vehicles] or [4])
        head = ["Vehicle", "Type", "Working Days", "Weekly Target", "Monthly Target"] + \
               [f"Week {n}" for n in range(1, maxw + 1)] + \
               ["Total Income", "% Achieved", "Days Lost", "Loss Amount", "Debt", "Excess", "Running Debt"]
    else:
        head = ["Vehicle", "Type", "Working Days", "Weekly Target", "Target", "Total Income", "% Achieved",
                "Days Lost", "Loss Amount", "New Debt", "Payments", "Excess", "Ending Debt"]
    rows = [[Paragraph(h.upper(), S["head"]) for h in head]]
    sums = {"wt": 0, "tg": 0, "inc": 0, "lost_d": 0, "lost_a": 0, "debt": 0, "exc": 0, "run": 0, "pay": 0}
    week_sums = {}
    for v in vehicles:
        p = pct(v["collected"], v["target"])
        sums["wt"] += v["weekly_target"]; sums["tg"] += v["target"]; sums["inc"] += v["collected"]
        sums["lost_d"] += v["lost_days"]; sums["lost_a"] += v["lost_amount"]; sums["debt"] += v["new_debt"]
        sums["exc"] += v["excess"]; sums["run"] += v["outstanding"]; sums["pay"] += v["debt_payments"]
        base = [Paragraph(f"<b>{v['name']}</b>", S["cell"]), Paragraph(v["type"], S["cell"]),
                Paragraph(f"{v['working_days']}/{v['working_days']}", S["cell"]),
                Paragraph(tsh(v["weekly_target"]), S["cellr"]), Paragraph(tsh(v["target"]), S["cellr"])]
        if single:
            by_num = {w["number"]: w["amount"] for w in v["weeks"]}
            wk = []
            for n in range(1, maxw + 1):
                if n <= v["week_count"]:
                    wk.append(Paragraph(tsh(by_num.get(n, 0)), S["cellr"]))
                    week_sums[n] = week_sums.get(n, 0) + by_num.get(n, 0)
                else:
                    wk.append(Paragraph("-", S["cellr"]))
            rest = [Paragraph(f"<b>{tsh(v['collected'])}</b>", S["cellr"]),
                    Paragraph(f"<font color='{tone(p).hexval().replace('0x', '#')}'><b>{p:.1f}%</b></font>", S["cellr"]),
                    Paragraph(str(v["lost_days"]), S["cellr"]), Paragraph(neg(v["lost_amount"]), S["cellr"]),
                    Paragraph(tsh(v["new_debt"]), S["cellr"]), Paragraph(tsh(v["excess"]), S["cellr"]),
                    Paragraph(tsh(v["outstanding"]), S["cellr"])]
            rows.append(base + wk + rest)
        else:
            rest = [Paragraph(f"<b>{tsh(v['collected'])}</b>", S["cellr"]),
                    Paragraph(f"<font color='{tone(p).hexval().replace('0x', '#')}'><b>{p:.1f}%</b></font>", S["cellr"]),
                    Paragraph(str(v["lost_days"]), S["cellr"]), Paragraph(neg(v["lost_amount"]), S["cellr"]),
                    Paragraph(tsh(v["new_debt"]), S["cellr"]), Paragraph(tsh(v["debt_payments"]), S["cellr"]),
                    Paragraph(tsh(v["excess"]), S["cellr"]), Paragraph(tsh(v["outstanding"]), S["cellr"])]
            rows.append(base + rest)
    if vehicles:
        P = lambda s: Paragraph(f"<b>{s}</b>", S["cellr"])
        tp = pct(sums["inc"], sums["tg"])
        if single:
            wcols = [P(tsh(week_sums.get(n, 0))) for n in range(1, maxw + 1)]
            rows.append([Paragraph("<b>TOTAL</b>", S["cell"]), "", "", P(tsh(sums["wt"])), P(tsh(sums["tg"]))]
                        + wcols + [P(tsh(sums["inc"])), P(f"{tp:.1f}%"), P(str(sums["lost_d"])), P(neg(sums["lost_a"])),
                                   P(tsh(sums["debt"])), P(tsh(sums["exc"])), P(tsh(sums["run"]))])
        else:
            rows.append([Paragraph("<b>TOTAL</b>", S["cell"]), "", "", P(tsh(sums["wt"])), P(tsh(sums["tg"])),
                         P(tsh(sums["inc"])), P(f"{tp:.1f}%"), P(str(sums["lost_d"])), P(neg(sums["lost_a"])),
                         P(tsh(sums["debt"])), P(tsh(sums["pay"])), P(tsh(sums["exc"])), P(tsh(sums["run"]))])
    # weights: wider columns for percentages and amounts that wrap, so the numbers stay readable
    weights = []
    for h in head:
        if h == "Vehicle":
            weights.append(2.2)
        elif h in ("% Achieved",):
            weights.append(1.6)
        elif h in ("Loss Amount", "Running Debt", "Ending Debt", "Total Income"):
            weights.append(1.4)
        elif h == "Type":
            weights.append(0.9)
        elif h == "Working Days":
            weights.append(1.25)
        else:
            weights.append(1.15)
    unit = AVAIL / sum(weights)
    widths = [w * unit for w in weights]
    if vehicles:
        story.append(_table(rows, widths, total=True))
    else:
        story.append(Paragraph("Hakuna gari kwa kipindi hiki.", S["note"]))

    # --- Monthly breakdown (ranges longer than one month) -------------------
    if not single and report["series"]:
        mrows = [[Paragraph(h, S["head"]) for h in ["MONTH", "TARGET", "COLLECTED", "% ACHIEVED", "EXPENSES",
                                                     "PERSONAL", "PROFIT", "PROFIT %", "OUTSTANDING"]]]
        for r in report["series"]:
            y, mo = int(r["month"][:4]), int(r["month"][5:7])
            pp = pct(r["profit"], r["collected"])
            mrows.append([Paragraph(f"{MONTHS_SW[mo - 1]} {y}", S["cell"]),
                          Paragraph(tsh(r["target"]), S["cellr"]), Paragraph(tsh(r["collected"]), S["cellr"]),
                          Paragraph(f"<font color='{tone(pct(r['collected'], r['target'])).hexval().replace('0x', '#')}'><b>{pct(r['collected'], r['target']):.1f}%</b></font>", S["cellr"]),
                          Paragraph(tsh(r["expenses"]), S["cellr"]), Paragraph(tsh(r["personal"]), S["cellr"]),
                          Paragraph(neg(-r["profit"]) if r["profit"] < 0 else tsh(r["profit"]), S["cellr"]),
                          Paragraph(f"{pp:.1f}%", S["cellr"]), Paragraph(tsh(r["outstanding"]), S["cellr"])])
        mw = [AVAIL * x for x in (0.14, 0.11, 0.12, 0.10, 0.11, 0.10, 0.11, 0.09)]
        mw.append(AVAIL - sum(mw))
        story.append(KeepTogether([Paragraph("Monthly Breakdown", S["h2"]), _table(mrows, mw, total=False)]))

    # --- Debt -----------------------------------------------------------------
    drows = [[Paragraph(h, S["head"]) for h in ["NEW DEBT", "DEBT PAYMENTS", "EXCESS", "ENDING DEBT", "DEBT AS % OF TARGET"]],
             [Paragraph(tsh(t["new_debt"]), S["cellr"]), Paragraph(tsh(t["debt_payments"]), S["cellr"]),
              Paragraph(tsh(t["excess"]), S["cellr"]), Paragraph(f"<b>{tsh(t['outstanding'])}</b>", S["cellr"]),
              Paragraph(f"{pct(t['outstanding'], t['target']):.1f}%", S["cellr"])]]
    story.append(KeepTogether([Paragraph("Debt Summary", S["h2"]), _table(drows, [AVAIL / 5] * 5)]))

    # --- Notes -----------------------------------------------------------------
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>Maelezo ya mahesabu.</b> Target ni kiasi cha kila wiki kikizidishwa na idadi ya wiki za mwezi. "
                           "Imekusanywa ni malipo ya madereva yaliyoingizwa kama mapato, pamoja na ziada. "
                           "Matumizi ya gari ni service, matairi, bima na malipo mengine ya gari. Malipo ya deni hayahesabiwi "
                           "kama matumizi kwa sababu yanapunguza deni. Deni lililobaki linatoka kwenye injini ya deni.",
                           S["note"]))
    story.append(Paragraph("Faida (net) = imekusanywa - matumizi ya gari - matumizi binafsi - hasara ya target.", S["note"]))

    on_page = partial(_header_footer, report=report)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()
