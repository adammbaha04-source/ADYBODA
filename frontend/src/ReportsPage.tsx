import { useEffect, useState } from "react";
import { getReport, type ReportData } from "./api";
import { GroupBars, Lines } from "./Charts";
import { monthLabel, tsh } from "./format";
import type { Vehicle } from "./types";

function ym(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function presetRange(n: number): [string, string] {
  const now = new Date();
  return [ym(new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)), ym(now)];
}
function yearRange(): [string, string] {
  const now = new Date();
  return [`${now.getFullYear()}-01`, ym(now)];
}

export default function ReportsPage({ mode, vehicles }: { mode: "report" | "graphs"; vehicles: Vehicle[] }) {
  const [from, setFrom] = useState(presetRange(6)[0]);
  const [to, setTo] = useState(presetRange(6)[1]);
  const [vehicle, setVehicle] = useState("ALL");
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!from || !to || from > to) { setError("Mwezi wa kuanzia lazima uwe kabla ya mwezi wa mwisho."); return; }
    setLoading(true);
    getReport(from, to, vehicle)
      .then((d) => { setData(d); setError(""); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, vehicle, vehicles.length]);

  function preset(p: [string, string]) { setFrom(p[0]); setTo(p[1]); }

  function downloadCsv() {
    if (!data) return;
    const head = ["Mwezi", "Target", "Imekusanywa", "Ziada", "Deni jipya", "Malipo ya deni", "Deni lililobaki", "Siku zilizopotea", "Hasara ya target", "Matumizi ya magari", "Matumizi binafsi", "Faida"];
    const rows = data.series.map((r) => [r.month, r.target, r.collected, r.excess, r.new_debt, r.debt_payments, r.outstanding, r.lost_days, r.lost_amount, r.expenses, r.personal, r.profit]);
    const csv = [head, ...rows].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ripoti_${from}_${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  const t = data?.totals;
  const labels = data ? data.series.map((r) => monthLabel(r.month)) : [];

  return (
    <div className="reports">
      <section className="card no-print">
        <div className="filter-row">
          <label>Kuanzia mwezi<input type="month" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>Hadi mwezi<input type="month" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <label>Gari
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="ALL">Magari yote</option>
            {vehicles.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
          </select>
        </label>
        <div className="chip-row">
          <button className="chip" onClick={() => preset(presetRange(1))}>Mwezi 1</button>
          <button className="chip" onClick={() => preset(presetRange(3))}>Miezi 3</button>
          <button className="chip" onClick={() => preset(presetRange(6))}>Miezi 6</button>
          <button className="chip" onClick={() => preset(yearRange())}>Mwaka huu</button>
        </div>
        {mode === "report" && (
          <div className="chip-row">
            <button className="btn-add" onClick={downloadCsv} disabled={!data}>Pakua CSV</button>
            <button className="btn-add alt" onClick={() => window.print()} disabled={!data}>Pakua PDF (Chapisha)</button>
          </div>
        )}
        {loading && <p className="hint">Inapakia...</p>}
        {error && <p className="error">{error}</p>}
      </section>

      {data && t && mode === "report" && (
        <>
          <section className="print-head">
            <h2>Ripoti ya Kifedha</h2>
            <p>Kipindi: {monthLabel(from)} hadi {monthLabel(to)} · {vehicle === "ALL" ? "Magari yote" : data.vehicles[0]?.name}</p>
          </section>
          <section className="card">
            <p className="note">Target si mapato halisi. "Imekusanywa" ndiyo malipo halisi ya madereva. Faida = imekusanywa − matumizi ya magari − matumizi binafsi − hasara ya target (fomula ile ile ya ripoti ya zamani).</p>
            <div className="kv-grid">
              <div><span>TARGET</span><b className="blue">{tsh(t.target)}</b></div>
              <div><span>IMEKUSANYWA</span><b className="green">{tsh(t.collected)}</b></div>
              <div><span>ZIADA (EXCESS)</span><b className="green">{tsh(t.excess)}</b></div>
              <div><span>DENI LILILOBAKI</span><b className="red">{tsh(t.outstanding)}</b></div>
              <div><span>DENI JIPYA</span><b className="orange">{tsh(t.new_debt)}</b></div>
              <div><span>MALIPO YA DENI</span><b className="green">{tsh(t.debt_payments)}</b></div>
              <div><span>SIKU ZILIZOPOTEA</span><b className="red">{t.lost_days}</b></div>
              <div><span>HASARA YA TARGET</span><b className="red">{tsh(t.lost_amount)}</b></div>
              <div><span>MATUMIZI YA MAGARI</span><b className="red">{tsh(t.expenses)}</b></div>
              <div><span>MATUMIZI BINAFSI</span><b className="red">{tsh(t.personal)}</b></div>
              <div><span>FAIDA (NET)</span><b className={t.profit >= 0 ? "green" : "red"}>{tsh(t.profit)}</b></div>
            </div>
          </section>

          <section className="card">
            <h3>Magari</h3>
            <div className="scroll">
              <table className="rtable">
                <thead><tr><th>Gari</th><th>Dereva</th><th>Target</th><th>Imekusanywa</th><th>Deni lililobaki</th><th>Siku zilizopotea</th><th>Service</th><th>Matumizi</th><th>Faida</th></tr></thead>
                <tbody>
                  {data.vehicles.length === 0 && <tr><td colSpan={9}>Hakuna gari kwa kipindi hiki</td></tr>}
                  {data.vehicles.map((v) => (
                    <tr key={v.id}>
                      <td><b>{v.name}</b><br /><small>{v.type}</small></td><td>{v.driver || "—"}</td>
                      <td>{tsh(v.target)}</td><td className="green">{tsh(v.collected)}</td><td className="red">{tsh(v.outstanding)}</td>
                      <td>{v.lost_days}</td><td>{tsh(v.service)}</td><td>{tsh(v.expenses)}</td>
                      <td className={v.profit >= 0 ? "green" : "red"}>{tsh(v.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h3>Kila Mwezi</h3>
            <div className="scroll">
              <table className="rtable">
                <thead><tr><th>Mwezi</th><th>Target</th><th>Imekusanywa</th><th>Deni jipya</th><th>Deni lililobaki</th><th>Hasara</th><th>Matumizi</th><th>Faida</th></tr></thead>
                <tbody>
                  {data.series.map((r) => (
                    <tr key={r.month}>
                      <td>{monthLabel(r.month)}</td><td>{tsh(r.target)}</td><td className="green">{tsh(r.collected)}</td>
                      <td>{tsh(r.new_debt)}</td><td className="red">{tsh(r.outstanding)}</td><td>{tsh(r.lost_amount)}</td>
                      <td>{tsh(r.expenses + r.personal)}</td><td className={r.profit >= 0 ? "green" : "red"}>{tsh(r.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
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
