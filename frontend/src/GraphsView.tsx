import type { CSSProperties, ReactNode } from "react";
import type { ReportV3 } from "./reportApi";
import { tsh } from "./format";

type ExpCat = { label: string; amount: number };
type Props = { data: ReportV3; expCats: ExpCat[]; period: string };
type DataProps = { data: ReportV3; period: string };

const LINE_COLORS = ["#6366f1", "#a855f7", "#3b82f6", "#1e40af", "#ec4899", "#10b981", "#f97316", "#14b8a6"];
const PIE_COLORS = ["#7077f0", "#eda020", "#9b6cf5", "#10b981", "#ec4899", "#3b82f6", "#f97316"];
const TARGET_COLOR = "#7b7ef0";
const ACTUAL_COLOR = "#34c38f";
const TITLE: CSSProperties = { textAlign: "center", fontSize: 17, fontWeight: 800, color: "#4b5563", margin: "4px 0 14px" };
const LEGEND: CSSProperties = { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 16px", listStyle: "none", padding: 0, margin: "0 0 8px", fontSize: 14, color: "#4b5563" };
const DOT: CSSProperties = { display: "inline-block", width: 16, height: 16, borderRadius: "50%" };

// Picks a neat axis step so the chart has about five gridlines.
function axis(maxVal: number) {
  const raw = Math.max(maxVal, 1) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  return { step, top: step * 5 };
}

// Smooth curve through the points (Catmull-Rom converted to Bezier curves).
function smooth(pts: [number, number][]) {
  if (pts.length === 0) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// A bar with rounded top corners only.
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(8, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

function WeeklyChart({ data, period }: DataProps) {
  if (!data.single_month) {
    return (
      <>
        <h3 style={TITLE}>Weekly Income - {period}</h3>
        <p className="hint" style={{ textAlign: "center" }}>The weekly chart is shown for a single month. Choose Monthly Report to see it.</p>
      </>
    );
  }
  const weekCount = Math.max(4, ...data.vehicles.map((v) => v.week_count));
  const W = 640, H = 340, L = 120, R = 16, T = 12, B = 44;
  const iw = W - L - R, ih = H - T - B;
  const allVals = data.vehicles.flatMap((v) => v.weeks.map((w) => w.amount));
  const { step, top } = axis(Math.max(0, ...allVals));
  const px = (i: number) => L + (weekCount === 1 ? iw / 2 : (i * iw) / (weekCount - 1));
  const py = (val: number) => T + ih - (val / top) * ih;

  return (
    <>
      <h3 style={TITLE}>Weekly Income for {period}</h3>
      <ul style={LEGEND}>
        {data.vehicles.map((v, vi) => (
          <li key={v.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...DOT, border: `3px solid ${LINE_COLORS[vi % LINE_COLORS.length]}` }} />
            {v.name}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Weekly income line chart">
        {Array.from({ length: 6 }, (_, k) => k * step).map((val) => (
          <g key={val}>
            <line x1={L} x2={W - R} y1={py(val)} y2={py(val)} stroke="#e5e7eb" />
            <text x={L - 8} y={py(val) + 5} textAnchor="end" fontSize="14" fill="#4b5563">{tsh(val)}</text>
          </g>
        ))}
        <text transform={`translate(18, ${T + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize="14" fill="#4b5563">Amount (TSh)</text>
        {data.vehicles.map((v, vi) => {
          const color = LINE_COLORS[vi % LINE_COLORS.length];
          const byNum = new Map(v.weeks.map((w) => [w.number, w.amount]));
          const pts: [number, number][] = Array.from({ length: v.week_count }, (_, i) => [px(i), py(byNum.get(i + 1) ?? 0)]);
          return (
            <g key={v.id}>
              <path d={smooth(pts)} fill="none" stroke={color} strokeWidth="3" />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r="5.5" fill="#fff" stroke={color} strokeWidth="3" />
              ))}
            </g>
          );
        })}
        {Array.from({ length: weekCount }, (_, i) => (
          <text key={i} x={px(i)} y={H - 16} textAnchor="middle" fontSize="14" fill="#4b5563">Week {i + 1}</text>
        ))}
      </svg>
    </>
  );
}

function ExpensePie({ cats, period }: { cats: ExpCat[]; period: string }) {
  const items = cats.filter((c) => c.amount > 0);
  const total = items.reduce((a, c) => a + c.amount, 0);
  if (total <= 0) {
    return (
      <>
        <h3 style={TITLE}>Expenses by Category - {period}</h3>
        <p className="hint" style={{ textAlign: "center" }}>No expenses recorded for this period</p>
      </>
    );
  }
  const cx = 120, cy = 120, r = 110;
  let angle = -Math.PI / 2;
  const slices = items.map((c, i) => {
    const frac = c.amount / total;
    const a0 = angle;
    const a1 = angle + frac * 2 * Math.PI;
    angle = a1;
    const d =
      items.length === 1
        ? `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx},${cy + r} A${r},${r} 0 1 1 ${cx},${cy - r} Z`
        : `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`;
    return { ...c, d, color: PIE_COLORS[i % PIE_COLORS.length], pct: frac * 100 };
  });

  return (
    <>
      <h3 style={TITLE}>Expenses by Category - {period}</h3>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <svg viewBox="0 0 240 240" width="220" height="220" role="img" aria-label="Expenses pie chart">
          {slices.map((s) => (
            <path key={s.label} d={s.d} fill={s.color} stroke="#fff" strokeWidth="2">
              <title>{`${s.label}: ${tsh(s.amount)} (${s.pct.toFixed(0)}%)`}</title>
            </path>
          ))}
        </svg>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 15, color: "#4b5563" }}>
          {slices.map((s) => (
            <li key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ ...DOT, background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function TargetChart({ data, period }: DataProps) {
  const vs = data.vehicles;
  if (vs.length === 0) {
    return (
      <>
        <h3 style={TITLE}>Target vs Actual Income - {period}</h3>
        <p className="hint" style={{ textAlign: "center" }}>No vehicles recorded for this period</p>
      </>
    );
  }
  const W = 640, H = 380, L = 120, R = 16, T = 12, B = 96;
  const iw = W - L - R, ih = H - T - B;
  const { step, top } = axis(Math.max(0, ...vs.flatMap((v) => [v.target, v.collected])));
  const py = (val: number) => T + ih - (val / top) * ih;
  const groupW = iw / vs.length;
  const barW = Math.min(22, groupW * 0.3);

  return (
    <>
      <h3 style={TITLE}>Target vs Actual Income - {period}</h3>
      <ul style={LEGEND}>
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...DOT, background: TARGET_COLOR }} />Target
        </li>
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...DOT, background: ACTUAL_COLOR }} />Actual Income
        </li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Target versus actual income bar chart">
        {Array.from({ length: 6 }, (_, k) => k * step).map((val) => (
          <g key={val}>
            <line x1={L} x2={W - R} y1={py(val)} y2={py(val)} stroke="#e5e7eb" />
            <text x={L - 8} y={py(val) + 5} textAnchor="end" fontSize="14" fill="#4b5563">{tsh(val)}</text>
          </g>
        ))}
        <text transform={`translate(18, ${T + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize="14" fill="#4b5563">Amount (TSh)</text>
        {vs.map((v, i) => {
          const gx = L + i * groupW;
          const cx = gx + groupW / 2;
          const base = T + ih;
          return (
            <g key={v.id}>
              <path d={barPath(cx - barW - 3, py(v.target), barW, base - py(v.target))} fill={TARGET_COLOR} />
              <path d={barPath(cx + 3, py(v.collected), barW, base - py(v.collected))} fill={ACTUAL_COLOR} />
              <text transform={`translate(${cx + 4}, ${base + 14}) rotate(-30)`} textAnchor="end" fontSize="13" fill="#4b5563">{v.name}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

type Series = { name: string; color: string; values: number[] };

const MONTH_SHORT = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"];
const mLabel = (ym: string) => `${MONTH_SHORT[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const qLabel = (ym: string) => `Q${Math.floor((Number(ym.slice(5, 7)) - 1) / 3) + 1} ${ym.slice(0, 4)}`;
const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pctOf = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const kLabel = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`);

function SeriesLegend({ series }: { series: Series[] }) {
  return (
    <ul style={LEGEND}>
      {series.map((s) => (
        <li key={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...DOT, background: s.color }} />{s.name}
        </li>
      ))}
    </ul>
  );
}

function GroupedBars({ labels, series }: { labels: string[]; series: Series[] }) {
  const W = 640, H = 300, L = 96, R = 12, T = 14, B = 52;
  const iw = W - L - R, ih = H - T - B;
  const { step, top } = axis(Math.max(0, ...series.flatMap((s) => s.values)));
  const py = (v: number) => T + ih - (v / top) * ih;
  const groupW = iw / Math.max(labels.length, 1);
  const barW = Math.min(26, (groupW * 0.75) / Math.max(series.length, 1));
  return (
    <>
      <SeriesLegend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Bar chart">
        {Array.from({ length: 6 }, (_, k) => k * step).map((val) => (
          <g key={val}>
            <line x1={L} x2={W - R} y1={py(val)} y2={py(val)} stroke="#e5e7eb" />
            <text x={L - 8} y={py(val) + 5} textAnchor="end" fontSize="13" fill="#4b5563">{kLabel(val)}</text>
          </g>
        ))}
        {labels.map((lab, i) => {
          const cx = L + i * groupW + groupW / 2;
          return (
            <g key={`${lab}-${i}`}>
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const x = cx - (series.length * barW) / 2 + si * barW;
                return (
                  <rect key={s.name} x={x + 1} y={py(v)} width={barW - 2} height={Math.max(0, T + ih - py(v))} rx={4} fill={s.color}>
                    <title>{`${s.name}: ${tsh(v)}`}</title>
                  </rect>
                );
              })}
              <text x={cx} y={H - 22} textAnchor="middle" fontSize="13" fill="#4b5563">{lab}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

function Trend({ labels, series }: { labels: string[]; series: Series[] }) {
  const W = 640, H = 300, L = 96, R = 12, T = 14, B = 52;
  const iw = W - L - R, ih = H - T - B;
  const { step, top } = axis(Math.max(0, ...series.flatMap((s) => s.values)));
  const py = (v: number) => T + ih - (v / top) * ih;
  const px = (i: number) => L + (labels.length === 1 ? iw / 2 : (i * iw) / (labels.length - 1));
  return (
    <>
      <SeriesLegend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Trend chart">
        {Array.from({ length: 6 }, (_, k) => k * step).map((val) => (
          <g key={val}>
            <line x1={L} x2={W - R} y1={py(val)} y2={py(val)} stroke="#e5e7eb" />
            <text x={L - 8} y={py(val) + 5} textAnchor="end" fontSize="13" fill="#4b5563">{kLabel(val)}</text>
          </g>
        ))}
        {series.map((s) => {
          const pts: [number, number][] = s.values.map((v, i) => [px(i), py(v)]);
          return (
            <g key={s.name}>
              <path d={smooth(pts)} fill="none" stroke={s.color} strokeWidth="3" />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r="5" fill="#fff" stroke={s.color} strokeWidth="3" />
              ))}
            </g>
          );
        })}
        {labels.map((lab, i) => (
          <text key={`${lab}-${i}`} x={px(i)} y={H - 22} textAnchor="middle" fontSize="13" fill="#4b5563">{lab}</text>
        ))}
      </svg>
    </>
  );
}

function Analysis({ data, period }: DataProps) {
  const rows = data.series;
  if (rows.length === 0) {
    return (
      <>
        <h3 style={TITLE}>Analysis - {period}</h3>
        <p className="hint" style={{ textAlign: "center" }}>No data for this period</p>
      </>
    );
  }
  const target = sumOf(rows.map((r) => r.target));
  const income = sumOf(rows.map((r) => r.collected));
  const spend = sumOf(rows.map((r) => r.expenses + r.personal));
  const profit = sumOf(rows.map((r) => r.profit));
  const ach = pctOf(income, target);
  const hit = rows.filter((r) => r.target > 0 && r.collected >= r.target).length;
  const best = rows.reduce((a, b) => (b.collected > a.collected ? b : a));
  const worst = rows.reduce((a, b) => (b.collected < a.collected ? b : a));
  const last = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const change = prev && prev.collected > 0 ? ((last.collected - prev.collected) / prev.collected) * 100 : null;
  const spendPct = pctOf(spend, income);
  const marginPct = pctOf(profit, income);

  const notes: string[] = [
    `Umefikia ${ach.toFixed(1)}% ya target: ${tsh(income)} kati ya ${tsh(target)}.`,
    `Miezi ${hit} kati ya ${rows.length} ilifikia target kamili.`,
    `Mwezi bora ni ${mLabel(best.month)} (${tsh(best.collected)}); dhaifu ni ${mLabel(worst.month)} (${tsh(worst.collected)}).`,
    `Wastani wa mapato kwa mwezi: ${tsh(income / rows.length)}.`,
  ];
  if (change !== null) {
    notes.push(`Mwezi wa mwisho (${mLabel(last.month)}) umebadilika ${change >= 0 ? "+" : ""}${change.toFixed(1)}% ukilinganisha na uliopita.`);
  }
  notes.push(`Matumizi ni ${spendPct.toFixed(1)}% ya mapato; faida halisi ni ${marginPct.toFixed(1)}% ya mapato.`);
  if (ach < 60) notes.push("Pendekezo: target haifikiwi. Pitia siku zilizopotea na uwezo wa magari kabla ya kuweka target mpya.");
  if (spendPct > 50) notes.push("Pendekezo: matumizi ni makubwa. Pitia gharama za service, matairi na bima.");
  if (data.totals.outstanding > 0) notes.push(`Deni lililobaki mwishoni: ${tsh(data.totals.outstanding)}.`);

  const cards = [
    { label: "Target", value: tsh(target), tone: "#2563eb" },
    { label: "Mapato", value: tsh(income), tone: "#059669" },
    { label: "Kufikia target", value: `${ach.toFixed(1)}%`, tone: ach >= 90 ? "#059669" : ach >= 60 ? "#ea580c" : "#dc2626" },
    { label: "Faida halisi", value: tsh(profit), tone: profit >= 0 ? "#059669" : "#dc2626" },
  ];
  return (
    <>
      <h3 style={TITLE}>Analysis - {period}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#f8fafc" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: c.tone, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "#334155" }}>
        {notes.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
    </>
  );
}

function MonthlyBars({ data, period }: DataProps) {
  const rows = data.series;
  return (
    <>
      <h3 style={TITLE}>Target vs Income by Month - {period}</h3>
      <GroupedBars
        labels={rows.map((r) => mLabel(r.month))}
        series={[
          { name: "Target", color: TARGET_COLOR, values: rows.map((r) => r.target) },
          { name: "Income", color: ACTUAL_COLOR, values: rows.map((r) => r.collected) },
        ]}
      />
    </>
  );
}

function QuarterBars({ data, period }: DataProps) {
  const order: string[] = [];
  const agg: Record<string, { target: number; collected: number }> = {};
  for (const r of data.series) {
    const q = qLabel(r.month);
    if (!agg[q]) { agg[q] = { target: 0, collected: 0 }; order.push(q); }
    agg[q].target += r.target;
    agg[q].collected += r.collected;
  }
  return (
    <>
      <h3 style={TITLE}>Quarterly Income - {period}</h3>
      <GroupedBars
        labels={order}
        series={[
          { name: "Target", color: TARGET_COLOR, values: order.map((q) => agg[q].target) },
          { name: "Income", color: ACTUAL_COLOR, values: order.map((q) => agg[q].collected) },
        ]}
      />
    </>
  );
}

function ExpenseProfit({ data, period }: DataProps) {
  const rows = data.series;
  return (
    <>
      <h3 style={TITLE}>Expenses vs Net Profit - {period}</h3>
      <Trend
        labels={rows.map((r) => mLabel(r.month))}
        series={[
          { name: "Expenses", color: "#ef4444", values: rows.map((r) => r.expenses + r.personal) },
          { name: "Net Profit", color: "#059669", values: rows.map((r) => r.profit) },
        ]}
      />
    </>
  );
}

function DebtChart({ data, period }: DataProps) {
  const rows = data.series;
  return (
    <>
      <h3 style={TITLE}>Debt: New vs Payments - {period}</h3>
      <GroupedBars
        labels={rows.map((r) => mLabel(r.month))}
        series={[
          { name: "New debt", color: "#f59e0b", values: rows.map((r) => r.new_debt) },
          { name: "Debt payments", color: "#0ea5e9", values: rows.map((r) => r.debt_payments) },
        ]}
      />
    </>
  );
}

export default function GraphsView({ data, expCats, period }: Props) {
  const hasQuarters = data.series.length >= 6;
  return (
    <>
      <section className="card"><Analysis data={data} period={period} /></section>
      <section className="card"><MonthlyBars data={data} period={period} /></section>
      {hasQuarters && <section className="card"><QuarterBars data={data} period={period} /></section>}
      {data.series.length >= 2 && <section className="card"><ExpenseProfit data={data} period={period} /></section>}
      <section className="card"><DebtChart data={data} period={period} /></section>
      <section className="card"><WeeklyChart data={data} period={period} /></section>
      <section className="card"><ExpensePie cats={expCats} period={period} /></section>
      <section className="card"><TargetChart data={data} period={period} /></section>
    </>
  );
}
