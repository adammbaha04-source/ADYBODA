import { useEffect, useState, type ReactNode } from "react";
import GraphsView from "./GraphsView";
import { monthLabel, tsh } from "./format";
import { downloadReportPdf, getInsights, getReportV3, type ReportV3 } from "./reportApi";
import type { Vehicle } from "./types";
import "./report.css";
import "./reports-v2.css";

type Kind = "month" | "q1" | "q2" | "q3" | "q4" | "year" | "custom";
type ViewTab = "report" | "graphs";

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

type Stat = { icon: string; label: string; value: string; sub: string; tone: string };

function StatCard({ s }: { s: Stat }) {
  return (
    <div className={`v2-stat tone-${s.tone}`}>
      <span className="v2-stat-icon">{s.icon}</span>
      <span className="v2-stat-label">{s.label}</span>
      <b className="v2-stat-value">{s.value}</b>
      <small className="v2-stat-sub">{s.sub}</small>
    </div>
  );
}

function Card({ icon, title, action, children, className = "" }: {
  icon: string; title: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`v2-card ${className}`}>
      <header className="v2-card-head">
        <span className="v2-card-ico">{icon}</span>
        <h2>{title}</h2>
        {action && <div className="v2-card-action">{action}</div>}
      </header>
      <div className="v2-card-body">{children}</div>
    </section>
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

function Donut({ income, expenses }: { income: number; expenses: number }) {
  const total = income + expenses;
  const r = 70;
  const c = 2 * Math.PI * r;
  const incShare = total > 0 ? income / total : 0;
  return (
    <svg viewBox="0 0 180 180" className="v2-donut" aria-hidden="true">
      <circle cx="90" cy="90" r={r} fill="none" stroke="#f59e0b" strokeWidth="26" />
      <circle cx="90" cy="90" r={r} fill="none" stroke="#16a34a" strokeWidth="26"
        strokeDasharray={`${incShare * c} ${c}`} transform="rotate(-90 90 90)" />
    </svg>
  );
}

function WeeklyLine({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const max = Math.max(1, ...values);
  const w = 260, h = 120, pad = 14;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (values.length - 1);
    const y = h - pad - (v / max) * (h - 2 * pad);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <div className="v2-weekly">
      <svg viewBox={`0 0 ${w} ${h}`} className="v2-line" aria-hidden="true">
        <path d={d} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill="#2563eb" />)}
      </svg>
      <div className="v2-weeklabels">
        {values.map((_, i) => <span key={i}>W{i + 1}</span>)}
      </div>
    </div>
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("report");
  const [insight, setInsight] = useState("");
  const [insightBusy, setInsightBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const year = Number(month.slice(0, 4)) || thisYear();
  const [from, to] = rangeFor(kind, month, year, cFrom, cTo);

  useEffect(() => {
    if (from > to) { setError("Mwezi wa kuanzia lazima uwe kabla ya mwezi wa kumalizia."); return; }
    setLoading(true);
    getReportV3(from, to, vehicle)
      .then((d) => { setData(d); setError(""); setInsight(""); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, vehicle, vehicles.length]);

  async function pdf() {
    setPdfBusy(true);
    try { await downloadReportPdf(from, to, vehicle); setError(""); }
    catch (e) { setError((e as Error).message); }
    finally { setPdfBusy(false); }
  }

  function downloadCsv() {
    if (!data) return;
    const head = ["Month", "Target", "Collected", "Excess", "New Debt", "Debt Payments", "Outstanding Debt",
      "Days Lost", "Loss Amount", "Service", "Tyres", "Insurance", "Other Payments", "Vehicle Expenses",
      "Personal Expenses", "Profit"];
    const rows = data.series.map((r) => [r.month, r.target, r.collected, r.excess, r.new_debt, r.debt_payments,
      r.outstanding, r.lost_days, r.lost_amount, r.service, r.tyres, r.insurance, r.other_payments, r.expenses,
      r.personal, r.profit]);
    const csv = [head, ...rows].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `report_${from}_${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
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
    const text = `${data.business_name} – ${reportTitleFor(kind)} (${periodText}): income ${tsh(t.collected)}, profit ${tsh(t.profit)}`;
    try {
      if (navigator.share) await navigator.share({ title: reportTitleFor(kind), text });
      else { await navigator.clipboard.writeText(text); setNotice("Summary copied"); }
    } catch { /* cancelled */ }
  }

  const t = data?.totals;
  const scope = vehicle === "ALL" ? "All vehicles" : vehicles.find((v) => String(v.id) === vehicle)?.name ?? "Single vehicle";
  const expCats = t ? [
    { label: "Service", amount: t.service },
    { label: "Tyres", amount: t.tyres },
    { label: "Insurance", amount: t.insurance },
    { label: "Other vehicle expenses", amount: t.other_payments },
    ...(data?.personal_categories ?? []).map((c) => ({ label: `Personal expense: ${c.label}`, amount: c.amount })),
  ].filter((c) => c.amount > 0) : [];
  const expTotal = expCats.reduce((a, c) => a + c.amount, 0);
  const maxWeek = data ? Math.max(4, ...data.vehicles.map((v) => v.week_count)) : 4;
  const isMonthly = kind === "month";
  const periodText = from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`;
  const weekTotals = data && data.single_month
    ? Array.from({ length: maxWeek }, (_, i) =>
        data.vehicles.reduce((a, v) => a + (v.weeks.find((w) => w.number === i + 1)?.amount ?? 0), 0))
    : [];

  const totalExpenses = t ? t.expenses + t.personal : 0;
  const stats: Stat[] = !t ? [] : isMonthly ? [
    { icon: "💰", label: "Total Income", value: tsh(t.collected), sub: `${pct(share(t.collected, t.target))} of real target`, tone: "green" },
    { icon: "👛", label: "Total Expenses", value: tsh(totalExpenses), sub: `${pct(share(totalExpenses, t.collected))} of income`, tone: "orange" },
    { icon: "📈", label: "Profit", value: tsh(t.profit), sub: `${pct(share(t.profit, t.collected))} margin`, tone: t.profit >= 0 ? "green" : "red" },
    { icon: "📅", label: "Working Days", value: `${t.working_days}/${t.theoretical_days}`, sub: `Lost: ${t.theoretical_days - t.working_days}`, tone: "purple" },
    { icon: "🎯", label: "Loss of Target", value: pct(share(t.lost_amount, t.theoretical_target)), sub: `${tsh(t.lost_amount)} below theoretical`, tone: "red" },
  ] : [
    { icon: "💰", label: "Total Income", value: tsh(t.collected), sub: "Actual collection", tone: "green" },
    { icon: "👛", label: "Total Expenses", value: tsh(totalExpenses), sub: "Operating costs", tone: "orange" },
    { icon: "📈", label: "Total Profit", value: tsh(t.profit), sub: "Income − expenses", tone: t.profit >= 0 ? "green" : "red" },
    { icon: "📅", label: "Days Lost", value: String(t.lost_days), sub: "Working days lost", tone: "purple" },
    { icon: "🎯", label: "Loss Amount", value: tsh(t.lost_amount), sub: "Financial impact of lost days", tone: "red" },
    { icon: "%", label: "Profit Margin", value: pct(share(t.profit, t.collected)), sub: "Profit as % of income", tone: t.profit >= 0 ? "green" : "red" },
  ];

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
        <article className="rpt v2-report">
          <header className="v2-banner">
            <div className="v2-banner-main">
              <span className="v2-banner-logo">{(data.business_name || "A").charAt(0).toUpperCase()}</span>
              <div>
                <div className="v2-banner-title">{reportTitleFor(kind)}</div>
                <div className="v2-banner-period">{from === to ? monthLabel(from) : `${from} to ${to}`}</div>
              </div>
            </div>
            <div className="v2-banner-meta">
              <div>Scope<b>{scope}</b></div>
              <div>Generated<b>{isoToDmy(data.generated)}</b></div>
            </div>
          </header>

          <h1 className="v2-title">{reportTitleFor(kind)}: {data.subtitle}</h1>

          <div className="v2-stats">
            {stats.map((s) => <StatCard key={s.label} s={s} />)}
          </div>

          <div className="v2-grid-2">
            <Card icon="🥧" title="Income vs Expenses" className="v2-card-chart">
              <div className="v2-donut-wrap">
                <Donut income={t.collected} expenses={totalExpenses} />
                <div className="v2-donut-center">
                  <span>TSh</span>
                  <b>{tsh(t.collected).replace("TSh ", "")}</b>
                  <span>Income</span>
                </div>
              </div>
              <div className="v2-legend">
                <div><i className="dot green" />Income<b>{tsh(t.collected)}</b></div>
                <div><i className="dot orange" />Expenses<b>{tsh(totalExpenses)}</b></div>
                <div className="v2-netprofit">
                  <span>Net Profit</span>
                  <em className={t.profit >= 0 ? "pos" : "neg"}>{tsh(t.profit)}</em>
                </div>
              </div>
            </Card>

            <Card icon="📊" title="Ending Debt & Target">
              {isMonthly && (
                <>
                  <Bar label="Theoretical Target" value={t.theoretical_target} max={t.theoretical_target} tone="blue" text={tsh(t.theoretical_target)} />
                  <Bar label="Real Target" value={t.target} max={t.theoretical_target} tone="blue" text={`${tsh(t.target)} (${pct(share(t.target, t.theoretical_target))})`} />
                </>
              )}
              <Bar label="New Debt" value={t.new_debt} max={Math.max(t.target, 1)} tone="orange" text={tsh(t.new_debt)} />
              <Bar label="Debt Payments" value={t.debt_payments} max={Math.max(t.target, 1)} tone="green" text={tsh(t.debt_payments)} />
              <Bar label="Excess" value={t.excess} max={Math.max(t.target, 1)} tone="blue" text={tsh(t.excess)} />
              <Bar label="Ending Debt" value={t.outstanding} max={Math.max(t.target, 1)} tone="red" text={tsh(t.outstanding)} />
            </Card>
          </div>

          <Card icon="📄" title="Debt Summary">
            <div className="v2-debt">
              <div className="v2-debt-tile blue"><span className="v2-debt-ico">➕</span><span>New Debt</span><b>{tsh(t.new_debt)}</b><small>New debt added</small></div>
              <div className="v2-debt-tile green"><span className="v2-debt-ico">✅</span><span>Debt Payments</span><b>{tsh(t.debt_payments)}</b><small>Debt recovered</small></div>
              <div className="v2-debt-tile amber"><span className="v2-debt-ico">🪙</span><span>Excess</span><b>{tsh(t.excess)}</b><small>Above target</small></div>
              <div className="v2-debt-tile red"><span className="v2-debt-ico">⚠️</span><span>Ending Debt</span><b>{tsh(t.outstanding)}</b><small>{pct(share(t.outstanding, t.target))} of target</small></div>
            </div>
          </Card>

          <div className="v2-grid-2">
            <Card icon="🚜" title="Vehicle Performance" action={<span className="v2-pill">{periodText}</span>}>
              {data.single_month ? (
                <>
                  <div className="v2-weekly-head">
                    <span>Weekly Income</span>
                    <b>{tsh(t.collected)}</b>
                    <small>(≈ {pct(share(t.collected, t.target))} of target)</small>
                  </div>
                  <WeeklyLine values={weekTotals} />
                </>
              ) : (
                data.vehicles.map((v) => (
                  <Bar key={v.id} label={v.name} value={v.collected} max={Math.max(t.target, 1)} tone="blue" text={tsh(v.collected)} />
                ))
              )}
            </Card>

            <Card icon="💡" title="AdyBajaj AI Insight" action={
              <button className="v2-btn-small" onClick={loadInsight} disabled={insightBusy}>
                {insightBusy ? "..." : "View Details →"}
              </button>
            }>
              <p className="v2-insight">
                {insight || `Income is ${pct(share(t.collected, t.target))} of target for this period. Keep monitoring expenses to reach your full target!`}
              </p>
            </Card>
          </div>

          <Card icon="🛠️" title="Vehicle Performance Table">
            <p className="v2-note">
              {data.single_month
                ? "Weekly income is the amount recorded in each week of the selected month. Percentage achieved = total income / monthly target."
                : "For the selected range, income, debt and losses are aggregated. Percentage achieved = total income / target for the period."}
            </p>
            <div className="v2-scroll">
              <table className="v2-table v2-mtable">
                <thead><tr>
                  <th>Vehicle</th><th>Type</th><th>Working Days</th><th className="num">Weekly Target</th>
                  <th className="num">{data.single_month ? "Monthly Target" : "Target"}</th>
                  {data.single_month && Array.from({ length: maxWeek }, (_, i) => <th className="num" key={i}>Week {i + 1}</th>)}
                  <th className="num">Total Income</th><th className="num">% Achieved</th><th className="num">Days Lost</th>
                  <th className="num">Loss Amount</th>
                  <th className="num">{data.single_month ? "Debt" : "New Debt"}</th>
                  {!data.single_month && <th className="num">Payments</th>}
                  <th className="num">Excess</th><th className="num">{data.single_month ? "Running Debt" : "Ending Debt"}</th>
                </tr></thead>
                <tbody>
                  {data.vehicles.length === 0 && <tr><td colSpan={12}>No vehicles recorded for this period</td></tr>}
                  {data.vehicles.map((v) => {
                    const p = share(v.collected, v.target);
                    const byNum = new Map(v.weeks.map((w) => [w.number, w.amount]));
                    return (
                      <tr key={v.id}>
                        <td><b>{v.name}</b><br /><small>{v.driver || "—"}</small></td>
                        <td>{v.type}</td>
                        <td>{v.working_days}</td>
                        <td className="num">{tsh(v.weekly_target)}</td>
                        <td className="num">{tsh(v.target)}</td>
                        {data.single_month && Array.from({ length: maxWeek }, (_, i) => (
                          <td className="num" key={i}>{i + 1 <= v.week_count ? tsh(byNum.get(i + 1) ?? 0) : "-"}</td>
                        ))}
                        <td className="num green"><b>{tsh(v.collected)}</b></td>
                        <td className={"num " + TONE(p)}><b>{pct(p)}</b></td>
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
                      <td>TOTAL</td><td></td><td></td>
                      <td className="num">{tsh(data.vehicles.reduce((a, v) => a + v.weekly_target, 0))}</td>
                      <td className="num">{tsh(t.target)}</td>
                      {data.single_month && Array.from({ length: maxWeek }, (_, i) => (
                        <td className="num" key={i}>{tsh(weekTotals[i] ?? 0)}</td>
                      ))}
                      <td className="num">{tsh(t.collected)}</td><td className="num">{pct(share(t.collected, t.target))}</td>
                      <td className="num">{t.lost_days}</td><td className="num">{minus(t.lost_amount)}</td>
                      <td className="num">{tsh(t.new_debt)}</td>
                      {!data.single_month && <td className="num">{tsh(t.debt_payments)}</td>}
                      <td className="num">{tsh(t.excess)}</td><td className="num">{tsh(t.outstanding)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="🧾" title="Monthly Expenses by Category">
            <div className="v2-scroll">
              <table className="v2-table">
                <thead><tr><th>Expense Category</th><th className="num">Amount</th><th className="num">Percentage</th></tr></thead>
                <tbody>
                  {expCats.length === 0 && <tr><td colSpan={3}>No expenses recorded for this period</td></tr>}
                  {expCats.map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}<div className="v2-mini-bar"><i style={{ width: `${clamp(share(c.amount, expTotal))}%` }} /></div></td>
                      <td className="num">{tsh(c.amount)}</td>
                      <td className="num">{pct(share(c.amount, expTotal))}</td>
                    </tr>
                  ))}
                  <tr className="total"><td>TOTAL</td><td className="num">{tsh(expTotal)}</td><td className="num">100.0%</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          {!data.single_month && data.series.length > 0 && (
            <Card icon="📆" title="Monthly Breakdown">
              <div className="v2-scroll">
                <table className="v2-table v2-mtable">
                  <thead><tr><th>Month</th><th className="num">Target</th><th className="num">Collected</th><th className="num">% Achieved</th><th className="num">Expenses</th><th className="num">Personal</th><th className="num">Profit</th><th className="num">Profit %</th><th className="num">Debt</th></tr></thead>
                  <tbody>
                    {data.series.map((r) => (
                      <tr key={r.month}>
                        <td>{monthLabel(r.month)}</td>
                        <td className="num">{tsh(r.target)}</td>
                        <td className="num green">{tsh(r.collected)}</td>
                        <td className={"num " + TONE(share(r.collected, r.target))}>{pct(share(r.collected, r.target))}</td>
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
            </Card>
          )}

          <footer className="v2-foot">
            <p><b>Calculation rules.</b> Monthly target is derived from each vehicle's daily target, working days, and the number of applicable weeks in the month.</p>
            <p>Expense categories are taken from actual vehicle expense records; percentages are calculated as category expense ÷ total expenses × 100.</p>
            <p>Profit = total income − total expenses. Loss of target is tracked separately: loss = theoretical target − real target, and its % is loss ÷ theoretical target. Debt is only income below the real target.</p>
          </footer>

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
