import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createService, deleteRecord, listServices } from "./api";
import { monthLabel, todayYMD, tsh } from "./format";
import { Bar, Pie, type Slice } from "./Charts";
import type { ServiceRecord, Vehicle } from "./types";

type Row = ServiceRecord & { vehicleId: number; vehicleName: string };

const SUGGEST = ["Oil", "Spear", "Grisi", "Matengenezo ya bodi", "Brake", "Chain", "Battery"];

export default function ServicePage({ vehicles, month }: { vehicles: Vehicle[]; month: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fVehicle, setFVehicle] = useState("");
  const [fMonth, setFMonth] = useState(month);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // form
  const [chombo, setChombo] = useState("ALL");
  const [fmMonth, setFmMonth] = useState(month);
  const [day, setDay] = useState(todayYMD());
  const [tool, setTool] = useState("");
  const [count, setCount] = useState("1");
  const [unit, setUnit] = useState("");
  const [seller, setSeller] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    try {
      const lists = await Promise.all(vehicles.map((v) => listServices(v.id).then((r) => r.map((s) => ({ ...s, vehicleId: v.id, vehicleName: v.name })))));
      setRows(lists.flat());
      setError("");
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicles.map((v) => v.id).join(",")]);
  useEffect(() => { setFMonth(month); setFmMonth(month); }, [month]);

  const filtered = useMemo(
    () => rows.filter((r) => (!fVehicle || String(r.vehicleId) === fVehicle) && r.day.startsWith(fMonth)),
    [rows, fVehicle, fMonth],
  );
  const total = filtered.reduce((a, r) => a + r.total, 0);
  const byTool = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((r) => { const k = (r.tool || "Nyingine").trim(); m[k] = (m[k] || 0) + r.total; });
    return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) as Slice[];
  }, [filtered]);

  function openAdd() {
    setAdding((v) => !v);
    setFmMonth(fMonth);
    setDay(`${fMonth}-${todayYMD().slice(8)}`);
    setNotice("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const targets = chombo === "ALL" ? vehicles : vehicles.filter((v) => String(v.id) === chombo);
    if (!targets.length) { setError("Chagua chombo."); return; }
    try {
      await Promise.all(targets.map((v) => createService(v.id, {
        day, tool: tool.trim(), count: Number(count) || 1, unit_price: Number(unit) || 0,
        seller: seller.trim(), note: note.trim(),
      })));
      setNotice(chombo === "ALL" ? "Service imehifadhiwa kwa vyombo vyote." : "Service imehifadhiwa.");
      setTool(""); setUnit(""); setSeller(""); setNote(""); setCount("1");
      setAdding(false);
      setFMonth(fmMonth);
      load();
    } catch (err) { setError((err as Error).message); }
  }

  async function remove(r: Row) {
    if (!confirm("Futa service hii?")) return;
    try { await deleteRecord("service-records", r.id); load(); }
    catch (err) { setError((err as Error).message); }
  }

  const formTotal = (Number(count) || 0) * (Number(unit) || 0) * (chombo === "ALL" ? vehicles.length : 1);

  return (
    <>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <section className="card">
        <div className="filter-row">
          <label>Chombo
            <select value={fVehicle} onChange={(e) => setFVehicle(e.target.value)}>
              <option value="">Vyombo Vyote</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label>Mwezi
            <input type="month" value={fMonth} onChange={(e) => setFMonth(e.target.value)} />
          </label>
        </div>
        <button className="btn-add" onClick={openAdd}>{adding ? "Funga" : "+ Ongeza Service"}</button>
      </section>

      {adding && (
        <section className="card form-card">
          <form onSubmit={submit}>
            <h3>Ongeza Service</h3>
            <label>Chagua Chombo
              <select value={chombo} onChange={(e) => setChombo(e.target.value)}>
                <option value="ALL">Vyombo Vyote</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label>Mwezi wa Record
              <input type="month" value={fmMonth} onChange={(e) => { setFmMonth(e.target.value); setDay(`${e.target.value}-01`); }} />
            </label>
            <p className="hint">{monthLabel(fmMonth)}</p>
            <label>Tarehe<input type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></label>
            <label>Kifaa / Huduma
              <input list="svc-suggest" value={tool} onChange={(e) => setTool(e.target.value)} placeholder="Oil, Spear, Grisi, Matengenezo ya bodi" required />
              <datalist id="svc-suggest">{SUGGEST.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label>Idadi<input type="number" inputMode="numeric" min={1} value={count} onChange={(e) => setCount(e.target.value)} required /></label>
            <label>Bei ya Kimoja (TSh)<input type="number" inputMode="numeric" min={0} value={unit} onChange={(e) => setUnit(e.target.value)} /></label>
            <label>Muuzaji<input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="Jina la muuzaji" /></label>
            <label>Maelezo<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
            <p className="hint">Jumla: {tsh(formTotal)}{chombo === "ALL" ? ` (vyombo ${vehicles.length})` : ""}</p>
            <button type="submit">Hifadhi</button>
            <button type="button" className="ghost" onClick={() => setAdding(false)}>Sitisha</button>
          </form>
        </section>
      )}

      <section className="card">
        <h3>Muhtasari wa Service · {monthLabel(fMonth)}</h3>
        <div className="kv-grid">
          <div><span>JUMLA YA SERVICE</span><b className="red">{tsh(total)}</b></div>
          <div><span>IDADI YA REKODI</span><b className="purple">{filtered.length}</b></div>
        </div>
        <h4 className="sub-title">Service kwa % (kwa kifaa/huduma)</h4>
        <Pie data={byTool} />
        <h4 className="sub-title">Asilimia kwa kila huduma</h4>
        {byTool.length === 0 && <p className="empty">No service records found</p>}
        {byTool.map((s) => (
          <Bar key={s.label} label={s.label} percent={total ? (s.value / total) * 100 : 0}
            color="#6366f1" text={`${total ? Math.round((s.value / total) * 100) : 0}% · ${tsh(s.value)}`} />
        ))}
      </section>

      <section className="card">
        <h3>Service Records</h3>
        <ul className="list">
          {filtered.length === 0 && <li className="empty">No service records found</li>}
          {[...filtered].sort((a, b) => b.day.localeCompare(a.day)).map((r) => (
            <li key={`${r.vehicleId}-${r.id}`}>
              <span>{r.day} · {r.tool} × {r.count} · {r.vehicleName}{r.seller ? ` · ${r.seller}` : ""}</span>
              <b className="blue">{tsh(r.total)}</b>
              <button className="danger" onClick={() => remove(r)}>Futa</button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
