import { useEffect, useState, type ReactNode } from "react";
import GraphsView from "./GraphsView";
import { monthLabel, tsh } from "./format";
import { downloadReportPdf, getInsights, getReportV3, type ReportV3 } from "./reportApi";
import type { Vehicle } from "./types";
import bajajImg from "./assets/bajaj-side.png";
import iconIncome from "./assets/icon-income.png";
import iconExpenses from "./assets/icon-expenses.png";
import iconProfit from "./assets/icon-profit.png";
import iconDays from "./assets/icon-days.png";
import iconTarget from "./assets/icon-target.png";
import iconAi from "./assets/icon-ai.png";
import "./report.css";
import "./reports-v2.css";
import "./reports-v3.css";

type Kind = "month" | "q1" | "q2" | "q3" | "q4" | "year" | "custom";
type ViewTab = "report" | "graphs";
type VKind = "boda" | "bajaj";
type Zone = { to: number; color: string };

const QUARTERS: { kind: Kind; label: string; range: string }[] = [
  { kind: "q1", label: "Q1", range: "Jan – Mar" },
  { kind: "q2", label: "Q2", range: "Apr – Jun" },
  { kind: "q3", label: "Q3", range: "Jul – Sep" },
  { kind: "q4", label: "Q4", range: "Oct – Dec" },
];

const pct = (n: number) => `${n.toFixed(1)}%`;
const share = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const minus = (n: number) => (n > 0 ? `(${tsh(n)})` : tsh(0));
const isoToDmy = (iso: string) => iso.split("-").reverse().join("/");
const thisYear = () => new Date().getFullYear();
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const TONE = (p: number) => (p >= 90 ? "green" : p >= 60 ? "orange" : "red");
const isYm = (s: string) => /^\d{4}-\d{2}$/.test(s);

const reportTitleFor = (kind: Kind) => {
  if (kind === "month") return "Monthly Report";
  if (kind === "year") return "Yearly Report";
  if (kind === "custom") return "Custom Report";
  return "Quarterly Report";
};

function rangeFor(kind: Kind, month: string, year: number, cFrom: string, cTo: string): [string, string] {
  if (kind === "month") return [month, month];
  if (kind === "year") return [`${year}-01`, `${year}-12`];
  if (kind === "custom") return [cFrom, cTo];
  const q = Number(kind.slice(1));
  return [`${year}-${String(q * 3 - 2).padStart(2, "0")}`, `${year}-${String(q * 3).padStart(2, "0")}`];
}

/* ---------- Previous period of the same length (for the trend index) ---------- */
const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
function prevRange(from: string, to: string): [string, string] {
  const n = monthIndex(to) - monthIndex(from) + 1;
  return [fromIndex(monthIndex(from) - n), fromIndex(monthIndex(to) - n)];
}

/* ---------- Vehicle pictures: bajaj photo or boda drawing, from the vehicle type ---------- */
const kindOf = (type?: string): VKind => (/boda|piki|moto|bike/i.test(type ?? "") ? "boda" : "bajaj");

function BodaArt({ height = 40 }: { height?: number }) {
  return (
    <svg viewBox="0 0 96 56" height={height} width={(height * 96) / 56} role="img" aria-label="Boda boda"
      fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="20" cy="40" r="10" />
      <circle cx="76" cy="40" r="10" />
      <path d="M20 40 L33 24 H55 L66 40" />
      <path d="M33 24 L48 40 H66" />
      <path d="M76 40 L68 14 M63 13 H77" />
      <path d="M29 20 H46" strokeWidth="4" />
    </svg>
  );
}

function VehiclePicture({ kind, height }: { kind: VKind; height: number }) {
  return kind === "bajaj"
    ? <img src={bajajImg} alt="Bajaj" style={{ height }} />
    : <BodaArt height={height * 0.7} />;
}

/* ---------- Speedometer gauge: half circle with coloured zones and a needle ---------- */
const C_RED = "#ef4444", C_AMBER = "#f59e0b", C_GREEN = "#16a34a";
const ZONES_HIGH_GOOD: Zone[] = [{ to: 60, color: C_RED }, { to: 90, color: C_AMBER }, { to: 100, color: C_GREEN }];
const ZONES_LOW_GOOD: Zone[] = [{ to: 30, color: C_GREEN }, { to: 60, color: C_AMBER }, { to: 100, color: C_RED }];
const ZONES_MARGIN: Zone[] = [{ to: 10, color: C_RED }, { to: 25, color: C_AMBER }, { to: 50, color: C_GREEN }];

function Gauge({ value, max = 100, zones, display, title, sub, unit = "%" }: {
  value: number; max?: number; zones: Zone[]; display: string; title: string; sub?: string; unit?: string;
}) {
  const cx = 110, cy = 105, r = 88;
  const frac = (v: number) => Math.max(0, Math.min(1, v / max));
  const pt = (f: number, rad: number) => {
    const th = Math.PI * (1 - f);
    return [cx + rad * Math.cos(th), cy - rad * Math.sin(th)] as const;
  };
  const arc = (f0: number, f1: number) => {
    const [x0, y0] = pt(f0, r);
    const [x1, y1] = pt(f1, r);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  let start = 0;
  const segs = zones.map((z) => {
    const seg = { d: arc(start, frac(z.to)), color: z.color };
    start = frac(z.to);
    return seg;
  });
  const ticks = Array.from({ length: 11 }, (_, i) => i / 10);

  // The needle starts at zero and sweeps to the value after the first paint.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const deg = frac(shown) * 180;
  const [lx, ly] = pt(0, r);
  const [rx] = pt(1, r);

  return (
    <div className="rp-gauge">
      <svg viewBox="0 0 220 150" role="img" aria-label={`${title}: ${display}`}>
        {segs.map((s, i) => <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth="18" />)}
        {ticks.map((f, i) => {
          const [x0, y0] = pt(f, r - 13);
          const [x1, y1] = pt(f, r - (i % 5 === 0 ? 22 : 18));
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#94a3b8" strokeWidth={i % 5 === 0 ? 2 : 1} />;
        })}
        <text x={lx} y={cy + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">0</text>
        <text x={cx} y={cy - r - 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">{max / 2}{unit}</text>
        <text x={rx} y={cy + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">{max}{unit}</text>
        <g className="rp-needle" style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${cx}px ${cy}px`, transformBox: "view-box" }}>
          <polygon points={`${cx - 78},${cy} ${cx},${cy - 5} ${cx},${cy + 5}`} fill="#0f2a55" />
        </g>
        <circle cx={cx} cy={cy} r="10" fill="#0f2a55" />
        <circle cx={cx} cy={cy} r="4" fill="#fff" />
        <text x={cx} y={cy + 40} textAnchor="middle" fontSize="24" fontWeight="900" fill="#0f2a55">{display}</text>
      </svg>
      <p className="rp-gauge-title">{title}</p>
      {sub && <p className="rp-gauge-sub">{sub}</p>}
    </div>
  );
}

/* ---------- Small building blocks ---------- */
function Trend({ cur, prev, upIsGood = true }: { cur: number; prev: number | null | undefined; upIsGood?: boolean }) {
  if (prev == null) return null;
  if (prev === 0 && cur === 0) return <span className="rp-trend flat">0%</span>;
  if (prev === 0) return <span className="rp-trend new">New</span>;
  const d = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(d) < 0.05) return <span className="rp-trend flat">0%</span>;
  const up = d > 0;
  return (
    <span className={`rp-trend ${up === upIsGood ? "good" : "bad"}`}>
      {up ? "▲ +" : "▼ −"}{Math.abs(d).toFixed(1)}%
    </span>
  );
}

function Section({ n, icon, title, aside, children }: {
  n?: string; icon?: string; title: string; aside?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="v2-card">
      <header className="v2-card-head">
        <span className="v2-card-ico">{n ?? icon}</span>
        <h2>{title}</h2>
        {aside && <div className="v2-card-action">{aside}</div>}
      </header>
      <div className="v2-card-body rp-stack">{children}</div>
    </section>
  );
}

function StatTile({ icon, label, value, tone, trend, sub, subTone = "" }: {
  icon: string; label: string; value: string; tone: string; trend?: ReactNode; sub?: string; subTone?: string;
}) {
  return (
    <div className={`v2-stat tone-${tone}`}>
      <img className="rp-stat-img" src={icon} alt="" />
      <span className="v2-stat-label">{label}</span>
      <b className="v2-stat-value">{value}</b>
      {trend}
      {sub && <small className={`rp-stat-sub ${subTone}`}>{sub}</small>}
    </div>
  );
}

function Kpi({ label, value, sub, tone = "", trend }: {
  label: string; value: string; sub?: string; tone?: string; trend?: ReactNode;
}) {
  return (
    <div className={`rp-kpi ${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
      {trend}
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Bar({ label, value, max, tone, text }: { label: string; value: number; max: number; tone: string; text: string }) {
  return (
    <div className="v2-bar-row">
      <div className="v2-bar-top"><span>{label}</span><b>{text}</b></div>
      <div className="v2-bar"><i className={tone} style={{ width: `${clamp(share(value, max))}%` }} /></div>
    </div>
  );
}

function WeeklyLine({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const max = Math.max(1, ...values);
  const w = 300, h = 110, pad = 16;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (values.length - 1);
    const y = h - pad - (v / max) * (h - 2 * pad);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="v2-line" aria-hidden="true">
      <path d={area} fill="#2563eb" opacity="0.12" />
      <path d={d} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill="#2563eb" />)}
    </svg>
  );
}

export default function ReportsPage({
  vehicles, month, onMonthChange,
}: {
  vehicles: Vehicle[];
  month: string;
  onMonthChange: (m: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("month");
  const [cFrom, setCFrom] = useState(`${thisYear()}-01`);
  const [cTo, setCTo] = useState(thisMonth());
  const [vehicle, setVehicle] = useState("ALL");
  const [data, setData] = useState<ReportV3 | null>(null);
  const [prev, setPrev] = useState<ReportV3 | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("report");
  const [insight, setInsight] = useState("");
  const [insightBusy, setInsightBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const year = Number(month.slice(0, 4)) || thisYear();
  const [from, to] = rangeFor(kind, month, year, cFrom, cTo);

  // Current period. The ignore flag stops a slow old response from replacing a newer one.
  useEffect(() => {
    if (!isYm(from) || !isYm(to)) return;
    if (from > to) { setError("Mwezi wa kuanzia lazima uwe kabla ya mwezi wa kumalizia."); return; }
    let ignore = false;
    setLoading(true);
    getReportV3(from, to, vehicle)
      .then((d) => { if (!ignore) { setData(d); setError(""); setInsight(""); } })
      .catch((e: Error) => { if (!ignore) setError(e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [from, to, vehicle, vehicles.length]);

  // Previous period, used only for the increase / decrease index.
  useEffect(() => {
    setPrev(null);
    if (!isYm(from) || !isYm(to) || from > to) return;
    let ignore = false;
    const [pf, ptEnd] = prevRange(from, to);
    getReportV3(pf, ptEnd, vehicle)
      .then((d) => { if (!ignore) setPrev(d); })
      .catch(() => { if (!ignore) setPrev(null); });
    return () => { ignore = true; };
  }, [from, to, vehicle, vehicles.length]);

  const t = data?.totals;
  const pt = prev?.totals;
  const title = data?.title ?? reportTitleFor(kind);
  const scope = vehicle === "ALL" ? "All vehicles" : vehicles.find((v) => String(v.id) === vehicle)?.name ?? "Single vehicle";
  const periodText = from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`;
  const prevText = prev ? (prev.from === prev.to ? monthLabel(prev.from) : `${monthLabel(prev.from)} – ${monthLabel(prev.to)}`) : "";

  const expCats = t ? [
    { label: "Service", amount: t.service },
    { label: "Tyres", amount: t.tyres },
    { label: "Insurance", amount: t.insurance },
    { label: "Other vehicle expenses", amount: t.other_payments },
    ...(data?.personal_categories ?? []).map((c) => ({ label: `Personal expense: ${c.label}`, amount: c.amount })),
  ].filter((c) => c.amount > 0) : [];
  const expTotal = expCats.reduce((a, c) => a + c.amount, 0);
  const totalExpenses = t ? t.expenses + t.personal : 0;
  const prevExpenses = pt ? pt.expenses + pt.personal : null;

  const maxWeek = data ? Math.max(4, ...data.vehicles.map((v) => v.week_count)) : 4;
  const weeksInMonth = data ? Math.max(0, ...data.vehicles.map((v) => v.week_count)) : 0;
  const weekTotals = data && data.single_month
    ? Array.from({ length: maxWeek }, (_, i) =>
        data.vehicles.reduce((a, v) => a + (v.weeks.find((w) => w.number === i + 1)?.amount ?? 0), 0))
    : [];
  const weekVals = weekTotals.slice(0, weeksInMonth);

  const kinds: VKind[] = data && data.vehicles.length > 0
    ? Array.from(new Set(data.vehicles.map((v) => kindOf(v.type))))
    : ["bajaj"];
  const fleetText = data && data.vehicles.length > 0
    ? (["bajaj", "boda"] as VKind[])
        .map((k) => [k, data.vehicles.filter((v) => kindOf(v.type) === k).length] as const)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k === "bajaj" ? "Bajaj" : "Boda"}`)
        .join(" · ")
    : "No vehicles";

  const trendRows = t && pt ? [
    { label: "Total income", cur: t.collected, prev: pt.collected, upIsGood: true, money: true },
    { label: "Total expenditure", cur: totalExpenses, prev: prevExpenses ?? 0, upIsGood: false, money: true },
    { label: "Net profit", cur: t.profit, prev: pt.profit, upIsGood: true, money: true },
    { label: "Days lost", cur: t.lost_days, prev: pt.lost_days, upIsGood: false, money: false },
    { label: "Ending debt", cur: t.outstanding, prev: pt.outstanding, upIsGood: false, money: true },
  ] : [];

  async function pdf() {
    setPdfBusy(true);
    try { await downloadReportPdf(from, to, vehicle); setError(""); }
    catch (e) { setError((e as Error).message); }
    finally { setPdfBusy(false); }
  }

  function downloadCsv() {
    if (!data) return;
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["Month", "Target", "Collected", "Excess", "New Debt", "Debt Payments", "Outstanding Debt",
      "Days Lost", "Loss Amount", "Service", "Tyres", "Insurance", "Other Payments", "Vehicle Expenses",
      "Personal Expenses", "Profit"];
    const rows = data.series.map((r) => [r.month, r.target, r.collected, r.excess, r.new_debt, r.debt_payments,
      r.outstanding, r.lost_days, r.lost_amount, r.service, r.tyres, r.insurance, r.other_payments, r.expenses,
      r.personal, r.profit]);
    const csv = "\ufeff" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `report_${from}_${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function loadInsight() {
    if (!data) return;
    setInsightBusy(true);
    try { setInsight((await getInsights(data)).insights); }
    catch (e) { setInsight((e as Error).message); }
    finally { setInsightBusy(false); }
  }

  async function shareReport() {
    if (!data || !t) return;
    const text = `${data.business_name} – ${title} (${periodText}): income ${tsh(t.collected)}, profit ${tsh(t.profit)}`;
    try {
      if (navigator.share) await navigator.share({ title, text });
      else { await navigator.clipboard.writeText(text); setNotice("Summary copied"); }
    } catch { /* cancelled */ }
  }

  const achieved = t ? share(t.collected, t.target) : 0;
  const targetShare = t ? share(t.target, t.theoretical_target) : 0;
  const lossPct = t ? share(t.lost_amount, t.theoretical_target) : 0;
  const margin = t ? share(t.profit, t.collected) : 0;
  const expRatio = t ? share(totalExpenses, t.collected) : 0;

  return (
    <div className="reports v2-wrap">
      <div className="v2-tabs no-print">
        <button className={"v2-tab" + (activeTab === "report" ? " on" : "")} onClick={() => setActiveTab("report")}>📄 Ripoti</button>
        <button className={"v2-tab" + (activeTab === "graphs" ? " on" : "")} onClick={() => setActiveTab("graphs")}>📊 Grafu</button>
      </div>

      <section className="v2-controls no-print">
        <div className="v2-seg">
          {([["month", "Monthly"], ["year", "Yearly"], ["custom", "Custom Range"]] as [Kind, string][]).map(([k, label]) => (
            <button key={k} className={"v2-seg-btn" + (kind === k ? " on" : "")} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>

        <div className="v2-q-head">Robo mwaka {year}</div>
        <div className="v2-q-grid">
          {QUARTERS.map((q) => (
            <button key={q.kind} className={"v2-q-tile" + (kind === q.kind ? " on" : "")} onClick={() => setKind(q.kind)}>
              <b>{q.label}</b>
              <small>{q.range}</small>
            </button>
          ))}
        </div>

        {kind === "custom" && (
          <div className="v2-custom">
            <label>Kuanzia<input type="month" value={cFrom} onChange={(e) => setCFrom(e.target.value)} /></label>
            <label>Hadi<input type="month" value={cTo} onChange={(e) => setCTo(e.target.value)} /></label>
          </div>
        )}

        <label className="v2-vehicle">Gari
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="ALL">Magari yote</option>
            {vehicles.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
          </select>
        </label>

        {loading && <p className="v2-hint">Inapakia...</p>}
        {error && <p className="v2-error">{error}</p>}
      </section>

      {data && t && activeTab === "report" && (
        <article className="rp-report">
          {/* Banner: title, fleet summary and the vehicle picture */}
          <header className="v2-banner rp-banner3">
            <div className="rp-banner-top">
              <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
                <rect x="6" y="30" width="10" height="16" rx="2" fill="#fff" />
                <rect x="21" y="22" width="10" height="24" rx="2" fill="#fff" />
                <rect x="36" y="12" width="10" height="34" rx="2" fill="#fff" />
                <path d="M6 22 L20 12 L28 16 L44 4" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div className="v2-banner-title">{title}</div>
                <div className="v2-banner-period">{data.subtitle}</div>
              </div>
            </div>
            <div className="rp-banner-fleet">
              <span>Fleet Summary · {scope}</span>
              <b>{fleetText}</b>
              <span>Generated {isoToDmy(data.generated)}</span>
            </div>
            <div className="rp-banner-pics">
              {kinds.map((k) => <VehiclePicture key={k} kind={k} height={104} />)}
            </div>
          </header>

          {/* Five headline tiles */}
          <div className="v2-stats" style={{ marginTop: 14 }}>
            <StatTile icon={iconIncome} tone="blue" label="Total Income" value={tsh(t.collected)}
              trend={<Trend cur={t.collected} prev={pt?.collected} />} sub={`${pct(achieved)} of target`} />
            <StatTile icon={iconExpenses} tone="orange" label="Total Expenses" value={tsh(totalExpenses)}
              trend={<Trend cur={totalExpenses} prev={prevExpenses} upIsGood={false} />} sub={`${pct(expRatio)} of income`} />
            <StatTile icon={iconProfit} tone={t.profit >= 0 ? "green" : "red"} label={t.profit >= 0 ? "Profit" : "Loss"}
              value={t.profit >= 0 ? tsh(t.profit) : minus(-t.profit)}
              trend={<Trend cur={t.profit} prev={pt?.profit} />} sub={`${pct(margin)} margin`} />
            <StatTile icon={iconDays} tone="purple" label="Working Days" value={`${t.working_days} / ${t.theoretical_days}`}
              sub={`Lost: ${t.lost_days}`} subTone={t.lost_days > 0 ? "red" : "green"} />
            <StatTile icon={iconTarget} tone="red" label="Loss of Target" value={pct(lossPct)}
              sub={lossPct > 0 ? "Below target" : "On target"} subTone={lossPct > 0 ? "red" : "green"} />
          </div>

          {/* Card 1: target and lost days */}
          <Section n="1" title="Target and lost days" aside={<span className="v2-pill">{periodText}</span>}>
            <div className="rp-gauge-row">
              <Gauge value={targetShare} zones={ZONES_HIGH_GOOD} display={pct(targetShare)}
                title="Actual target" sub={`of theoretical ${tsh(t.theoretical_target)}`} />
              <div className="rp-stack">
                <h3 className="rp-sub">Theoretical and actual target</h3>
                <Bar label="Theoretical target" value={t.theoretical_target} max={t.theoretical_target} tone="blue" text={tsh(t.theoretical_target)} />
                <Bar label="Actual target" value={t.target} max={t.theoretical_target} tone="green"
                  text={`${tsh(t.target)} (${pct(targetShare)})`} />
              </div>
            </div>
            <h3 className="rp-sub">Lost days</h3>
            <div className="rp-kpis four">
              <Kpi label="Working days" value={`${t.working_days} of ${t.theoretical_days}`} tone="purple" />
              <Kpi label="Days lost" value={String(t.lost_days)} tone={t.lost_days > 0 ? "red" : "green"}
                trend={<Trend cur={t.lost_days} prev={pt?.lost_days} upIsGood={false} />} />
              <Kpi label="Loss amount" value={tsh(t.lost_amount)} tone={t.lost_amount > 0 ? "red" : "green"}
                trend={<Trend cur={t.lost_amount} prev={pt?.lost_amount} upIsGood={false} />} />
              <Kpi label="Loss of target" value={pct(lossPct)} sub="of theoretical target" tone={lossPct > 0 ? "red" : "green"} />
            </div>
          </Section>

          {/* Card 2: income and debt */}
          <Section n="2" title="Income and debt">
            <h3 className="rp-sub">Income information</h3>
            <div className="rp-gauge-row">
              <Gauge value={achieved} zones={ZONES_HIGH_GOOD} display={pct(achieved)}
                title="Income achieved" sub={`${tsh(t.collected)} of ${tsh(t.target)}`} />
              <div className="rp-kpis">
                <Kpi label="Total income" value={tsh(t.collected)} tone="blue"
                  trend={<Trend cur={t.collected} prev={pt?.collected} />} />
                <Kpi label="Actual target" value={tsh(t.target)} />
                <Kpi label="Excess" value={tsh(t.excess)} sub="above target" tone="orange"
                  trend={<Trend cur={t.excess} prev={pt?.excess} />} />
                <Kpi label="Still to reach" value={tsh(Math.max(0, t.target - t.collected))} sub="to hit the target" />
              </div>
            </div>
            {data.single_month && weekVals.length > 0 && (
              <>
                <WeeklyLine values={weekVals} />
                <div className="rp-chips">
                  {weekVals.map((v, i) => (
                    <div className="rp-chip" key={i}>
                      <span>Week {i + 1}</span>
                      <b>{tsh(v)}</b>
                      {i > 0 ? <Trend cur={v} prev={weekVals[i - 1]} /> : <span>first week</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
            <h3 className="rp-sub">Debt information</h3>
            <div className="v2-debt">
              <div className="v2-debt-tile blue"><span className="v2-debt-ico">➕</span><span>New Debt</span><b>{tsh(t.new_debt)}</b>
                <Trend cur={t.new_debt} prev={pt?.new_debt} upIsGood={false} /><small>New debt added</small></div>
              <div className="v2-debt-tile green"><span className="v2-debt-ico">✅</span><span>Debt Payments</span><b>{tsh(t.debt_payments)}</b>
                <Trend cur={t.debt_payments} prev={pt?.debt_payments} /><small>Debt recovered</small></div>
              <div className="v2-debt-tile amber"><span className="v2-debt-ico">🪙</span><span>Excess</span><b>{tsh(t.excess)}</b>
                <small>Above target</small></div>
              <div className="v2-debt-tile red"><span className="v2-debt-ico">⚠️</span><span>Ending Debt</span><b>{tsh(t.outstanding)}</b>
                <Trend cur={t.outstanding} prev={pt?.outstanding} upIsGood={false} />
                <small>{pct(share(t.outstanding, t.target))} of target</small></div>
            </div>
          </Section>

          {/* Card 3: expenditure */}
          <Section n="3" title="Expenditure">
            <div className="rp-gauge-row">
              <Gauge value={expRatio} zones={ZONES_LOW_GOOD} display={pct(expRatio)}
                title="Expenses of income" sub="lower is better" />
              <div className="rp-kpis">
                <Kpi label="Vehicle expenses" value={tsh(t.expenses)} tone="orange"
                  trend={<Trend cur={t.expenses} prev={pt?.expenses} upIsGood={false} />} />
                <Kpi label="Personal expenses" value={tsh(t.personal)} tone="blue"
                  trend={<Trend cur={t.personal} prev={pt?.personal} upIsGood={false} />} />
                <Kpi label="Total expenditure" value={tsh(totalExpenses)} tone="red"
                  trend={<Trend cur={totalExpenses} prev={prevExpenses} upIsGood={false} />} />
                <Kpi label="Income" value={tsh(t.collected)} tone="green" />
              </div>
            </div>
            <h3 className="rp-sub">Where the money went</h3>
            {expCats.length === 0 && <p className="rp-note">No expenses recorded for this period.</p>}
            {expCats.map((c) => (
              <Bar key={c.label} label={c.label} value={c.amount} max={expTotal} tone="orange"
                text={`${tsh(c.amount)} (${pct(share(c.amount, expTotal))})`} />
            ))}
          </Section>

          {/* Card 4: profit and loss */}
          <Section n="4" title="Profit and loss" aside={
            <span className={`rp-verdict ${t.profit >= 0 ? "profit" : "loss"}`}>{t.profit >= 0 ? "Profit" : "Loss"}</span>
          }>
            <div className="rp-gauge-row">
              <Gauge value={margin} max={50} zones={ZONES_MARGIN} display={pct(margin)}
                title="Profit margin" sub="net result as % of income" />
              <div className="rp-statement">
                <div className="rp-line plus"><span>Income collected</span><b>{tsh(t.collected)}</b></div>
                <div className="rp-line minus"><span>Vehicle expenses</span><b>{minus(t.expenses)}</b></div>
                <div className="rp-line minus"><span>Personal expenses</span><b>{minus(t.personal)}</b></div>
                <div className="rp-line minus"><span>Lost target</span><b>{minus(t.lost_amount)}</b></div>
                <div className={`rp-line result ${t.profit >= 0 ? "profit" : "loss"}`}>
                  <span>{t.profit >= 0 ? "Net profit" : "Net loss"}</span>
                  <b>{t.profit >= 0 ? tsh(t.profit) : minus(-t.profit)}</b>
                </div>
              </div>
            </div>
          </Section>

          {/* Extra: increase / decrease index */}
          <Section icon="📈" title="Trend index" aside={prev ? <span className="v2-pill">vs {prevText}</span> : undefined}>
            {!prev && <p className="rp-note">The previous period is still loading or has no records.</p>}
            {prev && (
              <>
                <p className="v2-note">
                  Index 100 equals the previous period ({prevText}). Above 100 the figure went up, below 100 it went down. Green is good news, red is bad news.
                </p>
                <div className="v2-scroll">
                  <table className="v2-table">
                    <thead><tr>
                      <th>Measure</th><th className="num">This period</th><th className="num">Previous</th>
                      <th className="num">Index</th><th className="num">Change</th>
                    </tr></thead>
                    <tbody>
                      {trendRows.map((r) => (
                        <tr key={r.label}>
                          <td>{r.label}</td>
                          <td className="num">{r.money ? tsh(r.cur) : r.cur}</td>
                          <td className="num">{r.money ? tsh(r.prev) : r.prev}</td>
                          <td className="num">{r.prev > 0 ? Math.round((r.cur / r.prev) * 100) : "—"}</td>
                          <td className="num"><Trend cur={r.cur} prev={r.prev} upIsGood={r.upIsGood} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>

          {/* Income table */}
          <Section icon="🛠️" title="Income table" aside={<span className="v2-pill">{periodText}</span>}>
            <p className="v2-note">
              {data.single_month
                ? "Weekly income is the amount recorded in each week of the selected month. Achieved = total income divided by monthly target."
                : "For the selected range, income, debt and losses are added up. Achieved = total income divided by target for the period."}
            </p>
            <div className="v2-scroll">
              <table className="v2-table v2-mtable">
                <thead><tr>
                  <th>Vehicle</th><th>Working days</th><th className="num">Weekly target</th>
                  <th className="num">{data.single_month ? "Monthly target" : "Target"}</th>
                  {data.single_month && Array.from({ length: maxWeek }, (_, i) => <th className="num" key={i}>Week {i + 1}</th>)}
                  <th className="num">Total income</th><th className="num">Achieved</th><th className="num">Days lost</th>
                  <th className="num">Loss amount</th>
                  <th className="num">{data.single_month ? "Debt" : "New debt"}</th>
                  {!data.single_month && <th className="num">Payments</th>}
                  <th className="num">Excess</th><th className="num">{data.single_month ? "Running debt" : "Ending debt"}</th>
                </tr></thead>
                <tbody>
                  {data.vehicles.length === 0 && <tr><td colSpan={99}>No vehicles recorded for this period</td></tr>}
                  {data.vehicles.map((v) => {
                    const p = share(v.collected, v.target);
                    const byNum = new Map(v.weeks.map((w) => [w.number, w.amount]));
                    return (
                      <tr key={v.id}>
                        <td>
                          <div className="rp-veh">
                            <span className="rp-veh-pic"><VehiclePicture kind={kindOf(v.type)} height={34} /></span>
                            <div><b>{v.name}</b><small>{v.type} · {v.driver || "no driver"}</small></div>
                          </div>
                        </td>
                        <td>{v.working_days}</td>
                        <td className="num">{tsh(v.weekly_target)}</td>
                        <td className="num">{tsh(v.target)}</td>
                        {data.single_month && Array.from({ length: maxWeek }, (_, i) => (
                          <td className="num" key={i}>{i + 1 <= v.week_count ? tsh(byNum.get(i + 1) ?? 0) : "-"}</td>
                        ))}
                        <td className="num green"><b>{tsh(v.collected)}</b></td>
                        <td className={"num tone-" + TONE(p)}>{pct(p)}</td>
                        <td className="num">{v.lost_days}</td>
                        <td className="num red">{minus(v.lost_amount)}</td>
                        <td className="num red">{tsh(v.new_debt)}</td>
                        {!data.single_month && <td className="num green">{tsh(v.debt_payments)}</td>}
                        <td className="num green">{tsh(v.excess)}</td>
                        <td className="num red"><b>{tsh(v.outstanding)}</b></td>
                      </tr>
                    );
                  })}
                  {data.vehicles.length > 0 && (
                    <tr className="total">
                      <td>TOTAL</td><td></td>
                      <td className="num">{tsh(data.vehicles.reduce((a, v) => a + v.weekly_target, 0))}</td>
                      <td className="num">{tsh(t.target)}</td>
                      {data.single_month && Array.from({ length: maxWeek }, (_, i) => (
                        <td className="num" key={i}>{tsh(weekTotals[i] ?? 0)}</td>
                      ))}
                      <td className="num">{tsh(t.collected)}</td><td className="num">{pct(achieved)}</td>
                      <td className="num">{t.lost_days}</td><td className="num">{minus(t.lost_amount)}</td>
                      <td className="num">{tsh(t.new_debt)}</td>
                      {!data.single_month && <td className="num">{tsh(t.debt_payments)}</td>}
                      <td className="num">{tsh(t.excess)}</td><td className="num">{tsh(t.outstanding)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Expenses table */}
          <Section icon="🧾" title="Expenses table">
            <div className="v2-scroll">
              <table className="v2-table">
                <thead><tr><th>Expense category</th><th>Type</th><th className="num">Amount</th><th className="num">Share</th></tr></thead>
                <tbody>
                  {expCats.length === 0 && <tr><td colSpan={4}>No expenses recorded for this period</td></tr>}
                  {expCats.map((c) => {
                    const personal = c.label.startsWith("Personal expense");
                    return (
                      <tr key={c.label}>
                        <td>
                          {c.label.replace("Personal expense: ", "")}
                          <div className="v2-mini-bar"><i style={{ width: `${clamp(share(c.amount, expTotal))}%` }} /></div>
                        </td>
                        <td><span className={`rp-tag ${personal ? "personal" : "vehicle"}`}>{personal ? "Personal" : "Vehicle"}</span></td>
                        <td className="num">{tsh(c.amount)}</td>
                        <td className="num">{pct(share(c.amount, expTotal))}</td>
                      </tr>
                    );
                  })}
                  <tr className="total"><td>TOTAL</td><td></td><td className="num">{tsh(expTotal)}</td><td className="num">100.0%</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Monthly breakdown for ranges, with month-on-month change */}
          {!data.single_month && data.series.length > 0 && (
            <Section icon="📆" title="Monthly breakdown">
              <div className="v2-scroll">
                <table className="v2-table v2-mtable">
                  <thead><tr>
                    <th>Month</th><th className="num">Target</th><th className="num">Collected</th><th className="num">Achieved</th>
                    <th className="num">Income change</th><th className="num">Expenses</th><th className="num">Personal</th>
                    <th className="num">Profit</th><th className="num">Profit %</th><th className="num">Debt</th>
                  </tr></thead>
                  <tbody>
                    {data.series.map((r, i) => (
                      <tr key={r.month}>
                        <td>{monthLabel(r.month)}</td>
                        <td className="num">{tsh(r.target)}</td>
                        <td className="num green">{tsh(r.collected)}</td>
                        <td className={"num tone-" + TONE(share(r.collected, r.target))}>{pct(share(r.collected, r.target))}</td>
                        <td className="num">{i > 0 ? <Trend cur={r.collected} prev={data.series[i - 1].collected} /> : "—"}</td>
                        <td className="num">{tsh(r.expenses)}</td>
                        <td className="num">{tsh(r.personal)}</td>
                        <td className={"num " + (r.profit >= 0 ? "green" : "red")}>{r.profit >= 0 ? tsh(r.profit) : minus(-r.profit)}</td>
                        <td className="num">{pct(share(r.profit, r.collected))}</td>
                        <td className="num red">{tsh(r.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* AI insight with the robot picture */}
          <section className="v2-card">
            <div className="v2-card-body rp-ai">
              <img src={iconAi} alt="" />
              <div className="rp-ai-body">
                <h3>AdyBajaj AI Insight</h3>
                <p>
                  {insight || (pt && pt.collected > 0
                    ? `Your income is ${Math.abs(((t.collected - pt.collected) / pt.collected) * 100).toFixed(1)}% ${t.collected >= pt.collected ? "higher" : "lower"} than ${prevText}. Keep monitoring expenses to reach your full target!`
                    : `Income is ${pct(achieved)} of target for this period. Keep monitoring expenses to reach your full target!`)}
                </p>
                <button className="rp-ai-btn no-print" onClick={loadInsight} disabled={insightBusy}>
                  {insightBusy ? "..." : "View Details →"}
                </button>
              </div>
            </div>
          </section>

          <footer className="rp-foot">
            <p><b>How the figures are calculated.</b> Theoretical target is the daily target times the working days of the period. Actual target is what the debt engine used after lost days. Debt is only income below the actual target.</p>
            <p>Net profit = income collected − vehicle expenses − personal expenses − lost target. Expense shares are category amount ÷ total expenses. Gauge colours: income and target gauges are red below 60%, amber to 90%, green above; the expenses gauge is green up to 30% of income and red above 60%; the margin gauge is red below 10%, amber to 25%, green above.</p>
          </footer>

          {/* Download buttons */}
          <div className="v2-actions no-print">
            <button className="v2-action green" onClick={pdf} disabled={!data || pdfBusy}>
              <span>⬇</span>{pdfBusy ? "Inaandaa PDF..." : "Download PDF"}
            </button>
            <button className="v2-action orange" onClick={downloadCsv} disabled={!data}>
              <span>⬇</span>Download CSV
            </button>
            <button className="v2-action blue" onClick={() => window.print()} disabled={!data}>
              <span>🖨</span>Print Report
            </button>
            <button className="v2-action purple" onClick={shareReport} disabled={!data}>
              <span>⤴</span>Share Report
            </button>
          </div>
          {notice && <p className="v2-notice no-print">{notice}</p>}
        </article>
      )}

      {data && activeTab === "graphs" && (
        <GraphsView data={data} expCats={expCats} period={periodText} />
      )}
    </div>
  );
}
