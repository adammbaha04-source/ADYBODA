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

export default function GraphsView({ data, expCats, period }: Props) {
  return (
    <>
      <section className="card"><WeeklyChart data={data} period={period} /></section>
      <section className="card"><ExpensePie cats={expCats} period={period} /></section>
      <section className="card"><TargetChart data={data} period={period} /></section>
    </>
  );
}
