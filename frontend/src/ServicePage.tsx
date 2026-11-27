import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createService, deleteRecord, listServices } from "./api";
import { monthLabel, todayYMD, tsh } from "./format";
import { Bar, Pie, type Slice } from "./Charts";
import type { ServiceRecord, Vehicle } from "./types";

type Row = ServiceRecord & { vehicleId: number; vehicleName: string };

const SUGGEST = ["Oil", "Spear", "Grisi", "Matengenezo ya bodi", "Brake", "Chain", "Battery"];

// A date inside the selected month: today if today is in that month, otherwise the 1st.
function dayIn(month: string): string {
  const t = todayYMD();
  return t.startsWith(month) ? t : `${month}-01`;
}

// The month comes from the ONE period bar at the top of the app (Dashboard).
export default function ServicePage({ vehicles, month }: { vehicles: Vehicle[]; month: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fVehicle, setFVehicle] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // form
  const [chombo, setChombo] = useState("ALL");
  const [day, setDay] = useState(dayIn(month));
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
  useEffect(() => { setDay(dayIn(month)); setNotice(""); }, [month]);

  const filtered = useMemo(
    () => rows.filter((r) => (!fVehicle || String(r.vehicleId) === fVehicle) && r.day.startsWith(month)),
    [rows, fVehicle, month],
  );
  const total = filtered.reduce((a, r) => a + r.total, 0);
  const byTool = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((r) => { const k = (r.tool || "Nyingine").trim(); m[k] = (m[k] || 0) + r.total; });
    return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) as Slice[];
  }, [filtered]);

  function openAdd() {
    setAdding((v) => !v);
    setDay(dayIn(month));
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
      <style>{CSS}</style>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <header className="sv-hero">
        <div className="sv-hero-top">
          <span className="sv-hero-ico">🔧</span>
          <div>
            <h2>Service</h2>
            <p>{monthLabel(month)}</p>
          </div>
          <span className="sv-count">{filtered.length} rekodi</span>
        </div>
        <small>Jumla ya Service</small>
        <b>{tsh(total)}</b>
      </header>

      <section className="sv-tools">
        <label className="sv-pick">
          <span>Chombo</span>
          <select value={fVehicle} onChange={(e) => setFVehicle(e.target.value)}>
            <option value="">Vyombo Vyote</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <button type="button" className="sv-add" onClick={openAdd}>{adding ? "Funga" : "+ Ongeza Service"}</button>
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
        <h3>Service kwa kifaa / huduma</h3>
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

// Styles of this page (prefix sv- so nothing else in the app is touched).
const CSS = `
.sv-hero{margin:0 0 12px;padding:16px;border-radius:24px;color:#fff;background:linear-gradient(135deg,#0b2a6b,#0a1f4d);box-shadow:0 10px 24px rgba(10,31,77,.35)}
.sv-hero-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.sv-hero-ico{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:22px;background:linear-gradient(145deg,#3b82f6,#1d4ed8)}
.sv-hero h2{margin:0;font-size:19px;line-height:1.15;color:#fff}
.sv-hero p{margin:2px 0 0;font-size:12px;color:#c7d8fa}
.sv-count{margin-left:auto;padding:6px 11px;border-radius:999px;font-size:12px;font-weight:700;color:#0b2a5b;background:#fde047;white-space:nowrap}
.sv-hero small{display:block;font-size:13px;font-weight:600;color:#dbe7ff}
.sv-hero b{display:block;margin-top:2px;font-size:28px;line-height:1.1;color:#fde047}
.sv-tools{display:flex;align-items:flex-end;gap:10px;margin:0 0 12px}
.sv-pick{flex:1;min-width:0;margin:0;font-size:12px;font-weight:700;color:#3b5a8c}
.sv-pick select{display:block;width:100%;margin-top:4px;height:46px;border-radius:14px}
.sv-add{flex:none;width:auto;height:46px;padding:0 16px;border:0;border-radius:14px;font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,#34d399,#059669);box-shadow:0 6px 14px rgba(5,150,105,.3);cursor:pointer}
`;
