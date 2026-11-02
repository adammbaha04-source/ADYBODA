"""Charts and analysis for the PDF report. Drawn with reportlab, so no image library is needed."""
import math

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.legends import Legend
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.widgets.markers import makeMarker
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, Spacer

from fleet.reports import MONTHS_SW

TARGET = colors.HexColor("#3b82f6")
INCOME = colors.HexColor("#10b981")
EXPENSE = colors.HexColor("#ef4444")
PROFIT = colors.HexColor("#059669")
NEW_DEBT = colors.HexColor("#f59e0b")
PAYMENT = colors.HexColor("#0ea5e9")
CHART_H = 70 * mm


def _tsh(n):
    return f"TSh {round(n):,}"


def _k(v):
    return f"{round(v / 1000)}k" if abs(v) >= 1000 else f"{round(v)}"


def _label(ym):
    return f"{MONTHS_SW[int(ym[5:7]) - 1][:3]} {ym[2:4]}"


def _quarter(ym):
    return f"Q{(int(ym[5:7]) - 1) // 3 + 1} {ym[:4]}"


def _axis(vmax):
    """A neat top value and step so the chart has about five gridlines."""
    if vmax <= 0:
        return 5000, 1000
    raw = vmax / 5
    mag = 10 ** math.floor(math.log10(raw))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw)
    return step * 5, step


def _legend(pairs, x, y):
    lg = Legend()
    lg.x, lg.y = x, y
    lg.fontSize = 8
    lg.colorNamePairs = pairs
    lg.dxTextSpace = 5
    lg.deltay = 11
    return lg


def _setup_axes(ch, labels, top, step):
    ch.categoryAxis.categoryNames = labels
    ch.categoryAxis.labels.fontSize = 8
    ch.valueAxis.valueMin = 0
    ch.valueAxis.valueMax = top
    ch.valueAxis.valueStep = step
    ch.valueAxis.labelTextFormat = _k
    ch.valueAxis.labels.fontSize = 8


def _bars(labels, series, width):
    """series = [(name, color, values), ...]"""
    d = Drawing(width, CHART_H)
    top, step = _axis(max([0] + [v for _, _, vals in series for v in vals]))
    ch = VerticalBarChart()
    ch.x, ch.y = 52, 34
    ch.width, ch.height = width - 200, CHART_H - 52
    ch.data = [vals for _, _, vals in series]
    _setup_axes(ch, labels, top, step)
    ch.groupSpacing = 8
    ch.barSpacing = 2
    for i, (_, color, _) in enumerate(series):
        ch.bars[i].fillColor = color
        ch.bars[i].strokeColor = None
    d.add(ch)
    d.add(_legend([(c, n) for n, c, _ in series], width - 135, CHART_H - 22))
    return d


def _lines(labels, series, width):
    d = Drawing(width, CHART_H)
    top, step = _axis(max([0] + [v for _, _, vals in series for v in vals]))
    ch = HorizontalLineChart()
    ch.x, ch.y = 52, 34
    ch.width, ch.height = width - 200, CHART_H - 52
    ch.data = [vals for _, _, vals in series]
    _setup_axes(ch, labels, top, step)
    for i, (_, color, _) in enumerate(series):
        ch.lines[i].strokeColor = color
        ch.lines[i].strokeWidth = 2.2
        ch.lines[i].symbol = makeMarker("FilledCircle")
        ch.lines[i].symbol.fillColor = color
        ch.lines[i].symbol.size = 5
    d.add(ch)
    d.add(_legend([(c, n) for n, c, _ in series], width - 135, CHART_H - 22))
    return d


def _block(title, drawing, S):
    return KeepTogether([Paragraph(title, S["h2"]), drawing, Spacer(1, 6)])


def _quarters(rows):
    order, agg = [], {}
    for r in rows:
        q = _quarter(r["month"])
        if q not in agg:
            order.append(q)
            agg[q] = {"target": 0, "collected": 0}
        agg[q]["target"] += r["target"]
        agg[q]["collected"] += r["collected"]
    return order, agg


def _analysis(report, S):
    rows = report["series"]
    target = sum(r["target"] for r in rows)
    income = sum(r["collected"] for r in rows)
    spend = sum(r["expenses"] + r["personal"] for r in rows)
    profit = sum(r["profit"] for r in rows)
    ach = income / target * 100 if target else 0
    hit = sum(1 for r in rows if r["target"] and r["collected"] >= r["target"])
    best = max(rows, key=lambda r: r["collected"])
    worst = min(rows, key=lambda r: r["collected"])
    last = rows[-1]
    prev = rows[-2] if len(rows) > 1 else None
    spend_pct = spend / income * 100 if income else 0
    margin = profit / income * 100 if income else 0

    lines = [
        f"Umefikia <b>{ach:.1f}%</b> ya target: {_tsh(income)} kati ya {_tsh(target)}.",
        f"Miezi <b>{hit}</b> kati ya {len(rows)} ilifikia target kamili.",
        f"Mwezi bora ni <b>{_label(best['month'])}</b> ({_tsh(best['collected'])}); "
        f"dhaifu ni <b>{_label(worst['month'])}</b> ({_tsh(worst['collected'])}).",
        f"Wastani wa mapato kwa mwezi: <b>{_tsh(income / len(rows))}</b>.",
    ]
    if prev and prev["collected"] > 0:
        chg = (last["collected"] - prev["collected"]) / prev["collected"] * 100
        lines.append(f"Mwezi wa mwisho ({_label(last['month'])}) umebadilika <b>{chg:+.1f}%</b> "
                     f"ukilinganisha na uliopita.")
    lines.append(f"Matumizi ni <b>{spend_pct:.1f}%</b> ya mapato; faida halisi ni <b>{margin:.1f}%</b> ya mapato.")
    if ach < 60:
        lines.append("Pendekezo: target haifikiwi. Pitia siku zilizopotea na uwezo wa magari kabla ya kuweka target mpya.")
    if spend_pct > 50:
        lines.append("Pendekezo: matumizi ni makubwa. Pitia gharama za service, matairi na bima.")
    if report["totals"].get("outstanding", 0) > 0:
        lines.append(f"Deni lililobaki mwishoni: <b>{_tsh(report['totals']['outstanding'])}</b>.")

    body = [Paragraph("• " + line, S["note"]) for line in lines]
    return [KeepTogether([Paragraph("Uchambuzi wa Kipindi", S["h2"])] + body), Spacer(1, 8)]


def chart_flowables(report: dict, S: dict, width) -> list:
    """Everything the PDF needs for charts: analysis first, then the graphs."""
    rows = report.get("series") or []
    if not rows:
        return []
    labels = [_label(r["month"]) for r in rows]
    out = _analysis(report, S)

    out.append(_block("Target dhidi ya Mapato kwa Mwezi", _bars(labels, [
        ("Target", TARGET, [r["target"] for r in rows]),
        ("Mapato", INCOME, [r["collected"] for r in rows]),
    ], width), S))

    if len(rows) >= 6:
        order, agg = _quarters(rows)
        out.append(_block("Mapato kwa Robo Mwaka", _bars(order, [
            ("Target", TARGET, [agg[q]["target"] for q in order]),
            ("Mapato", INCOME, [agg[q]["collected"] for q in order]),
        ], width), S))

    if len(rows) >= 2:
        out.append(_block("Matumizi dhidi ya Faida Halisi", _lines(labels, [
            ("Matumizi", EXPENSE, [r["expenses"] + r["personal"] for r in rows]),
            ("Faida halisi", PROFIT, [r["profit"] for r in rows]),
        ], width), S))

    out.append(_block("Deni: Jipya dhidi ya Malipo", _bars(labels, [
        ("Deni jipya", NEW_DEBT, [r["new_debt"] for r in rows]),
        ("Malipo ya deni", PAYMENT, [r["debt_payments"] for r in rows]),
    ], width), S))
    return out
