import { useEffect, useState, type ReactNode } from "react";
import GraphsView from "./GraphsView";
import { monthLabel, tsh } from "./format";
import { downloadReportPdf, getReportV3, type ReportV3 } from "./reportApi";
import type { Vehicle } from "./types";
import "./report.css";
import "./reports-controls.css";

type Kind = "month" | "q1" | "q2" | "q3" | "q4" | "year" | "custom";

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
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

const reportTitleFor = (kind: Kind) => {
  if (kind === "month") return "Monthly Report";
  if (kind === "year") return "Yearly Report";
  if (kind === "custom") return "Custom Report";
  return "Quarterly Report";
};

// Turns the chosen period into the from/to months the API expects.
function rangeFor(kind: Kind, month: string, year: number, cFrom: string, cTo: string): [string, string] {
  if (kind === "month") return [month, month];
  if (kind === "year") return [`${year}-01`, `${year}-12`];
  if (kind === "custom") return [cFrom, cTo];
  const q = Number(kind.slice(1));
  return [`${year}-${String(q * 3 - 2).padStart(2, "0")}`, `${year}-${String(q * 3).padStart(2, "0")}`];
}

const TONE = (p: number) => (p >= 90 ? "green" : p >= 60 ? "orange" : "red");

function Kpi({ label, value, sub, tone, bar }: { label: string; value: string; sub: string; tone: string; bar?: number }) {
  return (
    <div className={"rpt-kpi tone-" + tone}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
      {bar !== undefined && <div className="bar"><i style={{ width: `${clamp(bar)}%` }} /></div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="rpt-h">{title}</h2>{children}</section>;
}

export default function ReportsPage({
  mode, vehicles, month, onMonthChange,
}: {
  mode: "report" | "graphs";
  vehicles: Vehicle[];
  month: string;                       // the single month selector lives on the Dashboard
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

  // Year for Quarterly and Yearly reports comes from the selected month.
  const year = Number(month.slice(0, 4)) || thisYear();
  const [from, to] = rangeFor(kind, month, year, cFrom, cTo);

  useEffect(() => {
    if (from > to) { setError("Mwezi wa kuanzia lazima uwe kabla ya mwezi wa kumalizia."); return; }
    setLoading(true);
    getReportV3(from, to, vehicle)
      .then((d) => { setData(d); setError(""); })
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

  const monthlyKpis = t ? [
    { label: "Theoretical Target", value: tsh(t.theoretical_target), sub: "Full target, no losses", tone: "blue", bar: 100 },
    { label: "Real Target", value: tsh(t.target), sub: `${pct(share(t.target, t.theoretical_target))} of theoretical`, tone: "blue", bar: share(t.target, t.theoretical_target) },
    { label: "Income", value: tsh(t.collected), sub: `${pct(share(t.collected, t.target))} of real target`, tone: "green", bar: share(t.collected, t.target) },
    { label: "Working Days", value: `${t.working_days}/${t.theoretical_days}`, sub: `Lost days: ${t.theoretical_days - t.working_days}`, tone: "orange", bar: share(t.working_days, t.theoretical_days) },
    { label: "Loss of Target", value: tsh(t.lost_amount), sub: `${pct(share(t.lost_amount, t.theoretical_target))} below theoretical`, tone: "red", bar: share(t.lost_amount, t.theoretical_target) },
    { label: "Total Expenses", value: tsh(t.expenses + t.personal), sub: `${pct(share(t.expenses + t.personal, t.collected))} of income`, tone: "orange", bar: share(t.expenses + t.personal, t.collected) },
    { label: "Profit", value: tsh(t.profit), sub: `${pct(share(t.profit, t.collected))} of income`, tone: t.profit >= 0 ? "green" : "red", bar: share(t.profit, t.collected) },
  ] : [];
  const periodKpis = t ? [
    { label: "Total Income", value: tsh(t.collected), sub: "Actual collection", tone: "green", bar: share(t.collected, t.target) },
    { label: "Total Expenses", value: tsh(t.expenses + t.personal), sub: "Operating costs", tone: "orange" },
    { label: "Days Lost", value: String(t.lost_days), sub: "Working days lost", tone: "orange" },
    { label: "Loss Amount", value: tsh(t.lost_amount), sub: "Financial impact of lost days", tone: "red", bar: share(t.lost_amount, t.theoretical_target) },
    { label: "Total Profit", value: tsh(t.profit), sub: "Income − expenses", tone: t.profit >= 0 ? "green" : "red" },
    { label: "Profit Margin", value: pct(share(t.profit, t.collected)), sub: "Profit as % of income", tone: share(t.profit, t.collected) >= 0 ? "green" : "red", bar: share(t.profit, t.collected) },
  ] : [];
  const kpis = isMonthly ? monthlyKpis : periodKpis;

  return (
    <div className="reports">
      <section className="card no-print rpt-controls">
        <div className="seg3">
          {([["month", "Monthly"], ["year", "Yearly"], ["custom", "Custom Range"]] as [Kind, string][]).map(([k, label]) => (
            <button key={k} className={"seg3-btn" + (kind === k ? " on" : "")} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>

        <div className="q-head">Robo mwaka {year}</div>
        <div className="q-grid">
          {QUARTERS.map((q) => (
            <button key={q.kind} className={"q-tile" + (kind === q.kind ? " on" : "")} onClick={() => setKind(q.kind)}>
              <b>{q.label}</b>
              <small>{q.range}</small>
            </button>
          ))}
        </div>

        {kind === "custom" && (
          <div className="custom-row">
            <label>Kuanzia<input type="month" value={cFrom} onChange={(e) => setCFrom(e.target.value)} /></label>
            <label>Hadi<input type="month" value={cTo} onChange={(e) => setCTo(e.target.value)} /></label>
          </div>
        )}

        <p className="period-note">
          Kipindi: <b>{kind === "custom" ? `${monthLabel(cFrom)} – ${monthLabel(cTo)}` : periodText}</b>
          {kind !== "custom" && <span> · chagua mwezi juu ya ukurasa</span>}
        </p>

        <label className="vehicle-pick">Gari
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="ALL">Magari yote</option>
            {vehicles.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
          </select>
        </label>

        {mode === "report" && (
          <div className="export-row">
            <button className="btn-add" onClick={pdf} disabled={!data || pdfBusy}>{pdfBusy ? "Inaandaa PDF..." : "Download PDF"}</button>
            <button className="btn-add alt" onClick={downloadCsv} disabled={!data}>Download CSV</button>
            <button className="btn-add alt" onClick={() => window.print()} disabled={!data}>Print</button>
          </div>
        )}
        {loading && <p className="hint">Inapakia...</p>}
        {error && <p className="error">{error}</p>}
      </section>

      {data && t && mode === "report" && (
        <article className="rpt">
          <header className="rpt-head">
            <div className="rpt-brand">
              <span className="rpt-logo">{(data.business_name || "A").charAt(0).toUpperCase()}</span>
              <div>
                <div className="rpt-biz">{data.business_name}</div>
                <div className="rpt-doc">{reportTitleFor(kind)}</div>
              </div>
            </div>
            <div className="rpt-meta">
              <div>Period<b>{from === to ? monthLabel(from) : `${from} to ${to}`}</b></div>
              <div>Scope<b>{scope}</b></div>
              <div>Generated<b>{isoToDmy(data.generated)}</b></div>
            </div>
          </header>

          <h1 className="rpt-title">{reportTitleFor(kind)}: {data.subtitle}</h1>

          <div className="rpt-kpis">
            {kpis.map((card) => (
              <Kpi key={card.label} label={card.label} value={card.value} sub={card.sub} tone={card.tone} bar={card.bar} />
            ))}
          </div>

          <Section title="Monthly Expenses by Category">
            <div className="rpt-scroll">
              <table className="rpt-table">
                <thead><tr><th>Expense Category</th><th className="num">Amount</th><th className="num">Percentage</th></tr></thead>
                <tbody>
                  {expCats.length === 0 && <tr><td colSpan={3}>No expenses recorded for this period</td></tr>}
                  {expCats.map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}<div className="rpt-bar"><i style={{ width: `${clamp(share(c.amount, expTotal))}%` }} /></div></td>
                      <td className="num">{tsh(c.amount)}</td>
                      <td className="num">{pct(share(c.amount, expTotal))}</td>
                    </tr>
                  ))}
                  <tr className="total"><td>TOTAL</td><td className="num">{tsh(expTotal)}</td><td className="num">100.0%</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Vehicle Performance">
            <p className="rpt-insights">
              {data.single_month
                ? "Weekly income is the amount recorded in each week of the selected month. Percentage achieved = total income / monthly target."
                : "For the selected range, income, debt and losses are aggregated. Percentage achieved = total income / target for the period."}
            </p>
            <div className="rpt-scroll">
              <table className="rpt-table rpt-mtable">
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
                        <td>{v.working_days}/{v.working_days}</td>
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
                        <td className="num" key={i}>{tsh(data.vehicles.reduce((a, v) => a + (v.weeks.find((w) => w.number === i + 1)?.amount ?? 0), 0))}</td>
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
          </Section>

          {!data.single_month && data.series.length > 0 && (
            <Section title="Monthly Breakdown">
              <div className="rpt-scroll">
                <table className="rpt-table rpt-mtable">
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
            </Section>
          )}

          <Section title="Debt Summary">
            <div className="rpt-debt">
              <Kpi label="New Debt" value={tsh(t.new_debt)} sub="New debt added" tone="orange" />
              <Kpi label="Debt Payments" value={tsh(t.debt_payments)} sub="Debt recovered" tone="green" />
              <Kpi label="Excess" value={tsh(t.excess)} sub="Above-target collections" tone="green" />
              <Kpi label="Ending Debt" value={tsh(t.outstanding)} sub={`${pct(share(t.outstanding, t.target))} of target`} tone="red" />
            </div>
          </Section>

          <footer className="rpt-foot">
            <p><b>Calculation rules.</b> Monthly target is derived from each vehicle's daily target, working days, and the number of applicable weeks in the month. Monthly income is the total recorded collection.</p>
            <p>Expense categories are taken from actual vehicle expense records; percentages are calculated as category expense ÷ total expenses × 100.</p>
            <p>Profit = total income − total expenses. Loss of target is tracked separately: loss = theoretical target − real target, and its % is loss ÷ theoretical target. Debt is only income below the real target.</p>
          </footer>
        </article>
      )}

      {data && mode === "graphs" && (
        <GraphsView data={data} expCats={expCats} period={periodText} />
      )}
    </div>
  );
}
