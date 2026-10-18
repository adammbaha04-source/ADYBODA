import { useEffect, useState, type ReactNode } from "react";
import { GroupBars, Lines } from "./Charts";
import { monthLabel, tsh } from "./format";
import { downloadReportPdf, getReportV3, type ReportV3 } from "./reportApi";
import type { Vehicle } from "./types";
import "./report.css";

type Kind = "month" | "q1" | "q2" | "q3" | "q4" | "year" | "custom";

const pct = (n: number) => `${n.toFixed(1)}%`;
const share = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const minus = (n: number) => (n > 0 ? `(${tsh(n)})` : tsh(0));
const isoToDmy = (iso: string) => iso.split("-").reverse().join("/");
const thisYear = () => new Date().getFullYear();
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

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

export default function ReportsPage({ mode, vehicles }: { mode: "report" | "graphs"; vehicles: Vehicle[] }) {
  const [kind, setKind] = useState<Kind>("month");
  const [month, setMonth] = useState(thisMonth());
  const [year, setYear] = useState(thisYear());
  const [cFrom, setCFrom] = useState(`${thisYear()}-01`);
  const [cTo, setCTo] = useState(thisMonth());
  const [vehicle, setVehicle] = useState("ALL");
  const [data, setData] = useState<ReportV3 | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [from, to] = rangeFor(kind, month, year, cFrom, cTo);

  useEffect(() => {
    if (from > to) { setError("Mwezi wa kuanzia lazima uwe kabla ya mwezi wa mwisho."); return; }
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
    const head = ["Mwezi", "Target", "Imekusanywa", "Ziada", "Deni jipya", "Malipo ya deni", "Deni lililobaki",
      "Siku zilizopotea", "Hasara ya target", "Service", "Matairi", "Bima", "Malipo mengine", "Matumizi ya magari",
      "Matumizi binafsi", "Faida"];
    const rows = data.series.map((r) => [r.month, r.target, r.collected, r.excess, r.new_debt, r.debt_payments,
      r.outstanding, r.lost_days, r.lost_amount, r.service, r.tyres, r.insurance, r.other_payments, r.expenses,
      r.personal, r.profit]);
    const csv = [head, ...rows].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ripoti_${from}_${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  const t = data?.totals;
  const labels = data ? data.series.map((r) => monthLabel(r.month)) : [];
  const scope = vehicle === "ALL" ? "Magari yote" : vehicles.find((v) => String(v.id) === vehicle)?.name ?? "Gari moja";
  const expCats = t ? [
    { label: "Service", amount: t.service },
    { label: "Tairi (Tyres)", amount: t.tyres },
    { label: "Bima (Insurance)", amount: t.insurance },
    { label: "Malipo mengine ya gari (TRA, maegesho, faini)", amount: t.other_payments },
    ...(data?.personal_categories ?? []).map((c) => ({ label: `Matumizi binafsi: ${c.label}`, amount: c.amount })),
  ].filter((c) => c.amount > 0) : [];
  const expTotal = expCats.reduce((a, c) => a + c.amount, 0);
  const maxWeek = data ? Math.max(4, ...data.vehicles.map((v) => v.week_count)) : 4;

  return (
    <div className="reports">
      <section className="card no-print">
        <div className="chip-row">
          <button className={"chip" + (kind === "month" ? " on" : "")} onClick={() => setKind("month")}>Ripoti ya Mwezi</button>
          <button className={"chip" + (kind === "q1" ? " on" : "")} onClick={() => setKind("q1")}>Robo 1 (Q1)</button>
          <button className={"chip" + (kind === "q2" ? " on" : "")} onClick={() => setKind("q2")}>Robo 2 (Q2)</button>
          <button className={"chip" + (kind === "q3" ? " on" : "")} onClick={() => setKind("q3")}>Robo 3 (Q3)</button>
          <button className={"chip" + (kind === "q4" ? " on" : "")} onClick={() => setKind("q4")}>Robo 4 (Q4)</button>
          <button className={"chip" + (kind === "year" ? " on" : "")} onClick={() => setKind("year")}>Ripoti ya Mwaka</button>
          <button className={"chip" + (kind === "custom" ? " on" : "")} onClick={() => setKind("custom")}>Kipindi maalum</button>
        </div>
        <div className="filter-row">
          {kind === "month" && <label>Mwezi<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>}
          {kind !== "month" && kind !== "custom" && (
            <label>Mwaka<input type="number" value={year} min={2020} max={2100} onChange={(e) => setYear(Number(e.target.value) || thisYear())} /></label>
          )}
          {kind === "custom" && <>
            <label>Kuanzia mwezi<input type="month" value={cFrom} onChange={(e) => setCFrom(e.target.value)} /></label>
            <label>Hadi mwezi<input type="month" value={cTo} onChange={(e) => setCTo(e.target.value)} /></label>
          </>}
        </div>
        <label>Gari
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="ALL">Magari yote</option>
            {vehicles.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
          </select>
        </label>
        {mode === "report" && (
          <div className="chip-row">
            <button className="btn-add" onClick={pdf} disabled={!data || pdfBusy}>{pdfBusy ? "Inaandaa PDF..." : "Pakua PDF"}</button>
            <button className="btn-add alt" onClick={downloadCsv} disabled={!data}>Pakua CSV</button>
            <button className="btn-add alt" onClick={() => window.print()} disabled={!data}>Chapisha</button>
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
                <div className="rpt-doc">{data.title}</div>
              </div>
            </div>
            <div className="rpt-meta">
              <div>Kipindi<b>{from === to ? monthLabel(from) : `${from} hadi ${to}`}</b></div>
              <div>Wigo<b>{scope}</b></div>
              <div>Imetolewa<b>{isoToDmy(data.generated)}</b></div>
            </div>
          </header>

          <h1 className="rpt-title">{data.title}: {data.subtitle}</h1>

          <div className="rpt-kpis">
            <Kpi label="Income vs Target" value={tsh(t.collected)} sub={`${pct(share(t.collected, t.target))} ya target ${tsh(t.target)}`} tone="green" bar={share(t.collected, t.target)} />
            <Kpi label="Expenditure of Income" value={tsh(t.expenses + t.personal)} sub={`${pct(share(t.expenses + t.personal, t.collected))} ya mapato`} tone="orange" bar={share(t.expenses + t.personal, t.collected)} />
            <Kpi label="Loss of Target" value={tsh(t.lost_amount)} sub={`${pct(share(t.lost_amount, t.target))} ya target · siku ${t.lost_days}`} tone="red" bar={share(t.lost_amount, t.target)} />
            <Kpi label="Profit Margin" value={tsh(t.profit)} sub={`${pct(share(t.profit, t.collected))} ya mapato`} tone={t.profit >= 0 ? "green" : "red"} bar={share(t.profit, t.collected)} />
          </div>
          <div className="rpt-kpis rpt-kpis-2">
            <Kpi label="Gross margin (kabla ya hasara)" value={pct(share(t.collected - t.expenses - t.personal, t.collected))} sub="(mapato − matumizi − binafsi) / mapato" tone={TONE(share(t.collected - t.expenses - t.personal, t.collected))} bar={share(t.collected - t.expenses - t.personal, t.collected)} />
            <Kpi label="Net profit margin" value={pct(share(t.profit, t.collected))} sub="faida / mapato" tone={TONE(share(t.profit, t.collected))} bar={share(t.profit, t.collected)} />
            <Kpi label="Collection rate" value={pct(share(t.collected, t.target))} sub="imekusanywa / target" tone={TONE(share(t.collected, t.target))} bar={share(t.collected, t.target)} />
            <Kpi label="Debt ratio" value={pct(share(t.outstanding, t.target))} sub="deni / target" tone="red" bar={share(t.outstanding, t.target)} />
          </div>

          <Section title="Monthly Expenses by Category">
            <div className="rpt-scroll">
              <table className="rpt-table">
                <thead><tr><th>Expense Category</th><th className="num">Amount</th><th className="num">Percentage</th></tr></thead>
                <tbody>
                  {expCats.length === 0 && <tr><td colSpan={3}>Hakuna matumizi kwa kipindi hiki</td></tr>}
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
                ? "Week dates: Weekly income is the income recorded for each week of the month (excess is not counted). % Achieved = total income / monthly target."
                : "Period: income, debt and losses are summed across the whole period. % Achieved = total income / target of the period."}
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
                  {data.vehicles.length === 0 && <tr><td colSpan={12}>Hakuna gari kwa kipindi hiki</td></tr>}
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
                  <thead><tr><th>Mwezi</th><th className="num">Target</th><th className="num">Collected</th><th className="num">% Achieved</th><th className="num">Expenses</th><th className="num">Personal</th><th className="num">Profit</th><th className="num">Profit %</th><th className="num">Outstanding</th></tr></thead>
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
              <Kpi label="New Debt" value={tsh(t.new_debt)} sub="deni jipya" tone="orange" />
              <Kpi label="Debt Payments" value={tsh(t.debt_payments)} sub="malipo ya deni" tone="green" />
              <Kpi label="Excess" value={tsh(t.excess)} sub="mapato ya ziada" tone="green" />
              <Kpi label="Ending Debt" value={tsh(t.outstanding)} sub={`${pct(share(t.outstanding, t.target))} ya target`} tone="red" />
            </div>
          </Section>

          <footer className="rpt-foot">
            <p><b>Maelezo ya mahesabu.</b> Target ni kiasi cha kila wiki kikizidishwa na idadi ya wiki za mwezi.
              Imekusanywa ni malipo ya madereva yaliyoingizwa kama mapato, pamoja na ziada.</p>
            <p>Matumizi ya gari ni service, matairi, bima na malipo mengine ya gari. Malipo ya deni hayahesabiwi kama matumizi,
              kwa sababu yanapunguza deni. Deni lililobaki linatoka kwenye injini ya deni, si makadirio.</p>
            <p>Faida (net) = imekusanywa − matumizi ya gari − matumizi binafsi − hasara ya target.</p>
          </footer>
        </article>
      )}

      {data && mode === "graphs" && (
        <>
          <section className="card">
            <h3>Target dhidi ya Imekusanywa</h3>
            <GroupBars labels={labels} series={[
              { name: "Target", color: "#3b82f6", values: data.series.map((r) => r.target) },
              { name: "Imekusanywa", color: "#10b981", values: data.series.map((r) => r.collected) },
            ]} />
          </section>
          <section className="card">
            <h3>Matumizi dhidi ya Faida</h3>
            <Lines labels={labels} series={[
              { name: "Matumizi", color: "#dc2626", values: data.series.map((r) => r.expenses + r.personal) },
              { name: "Faida (net)", color: "#059669", values: data.series.map((r) => r.profit) },
            ]} />
          </section>
          <section className="card">
            <h3>Deni Jipya na Malipo ya Deni</h3>
            <GroupBars labels={labels} series={[
              { name: "Deni jipya", color: "#f59e0b", values: data.series.map((r) => r.new_debt) },
              { name: "Malipo ya deni", color: "#10b981", values: data.series.map((r) => r.debt_payments) },
            ]} />
          </section>
          <section className="card">
            <h3>Deni Lililobaki</h3>
            <Lines labels={labels} series={[
              { name: "Deni lililobaki", color: "#dc2626", values: data.series.map((r) => r.outstanding) },
            ]} empty="Hakuna deni lililobaki kwa kipindi hiki" />
          </section>
        </>
      )}
    </div>
  );
}
