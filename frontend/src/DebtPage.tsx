import { useEffect, useState, type FormEvent } from "react";
import { addManualEntry, getDebt } from "./api";
import { monthLabel, todayYMD, tsh } from "./format";
import { Bar } from "./Charts";
import type { DebtSummary, Vehicle } from "./types";

type Item = { vehicle: Vehicle; s: DebtSummary };

export default function DebtPage({ vehicles, month }: { vehicles: Vehicle[]; month: string }) {
  const [fVehicle, setFVehicle] = useState("");
  const [fMonth, setFMonth] = useState(month);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [mVehicle, setMVehicle] = useState("");
  const [mDay, setMDay] = useState(todayYMD());
  const [mAmount, setMAmount] = useState("");
  const [mNote, setMNote] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      const list = await Promise.all(vehicles.map((v) => getDebt(v.id, fMonth).then((d) => ({ vehicle: v, s: d.summary }))));
      setItems(list);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { setFMonth(month); }, [month]);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [fMonth, vehicles.map((v) => v.id).join(",")]);

  const shown = items.filter((i) => !fVehicle || String(i.vehicle.id) === fVehicle);
  const carry = shown.reduce((a, i) => a + i.s.starting_debt, 0);
  const added = shown.reduce((a, i) => a + i.s.debt_added, 0);
  const paid = shown.reduce((a, i) => a + i.s.payments, 0);
  const ending = shown.reduce((a, i) => a + i.s.ending_debt, 0);
  const weekly = shown.reduce((a, i) => a + i.s.weekly_target, 0);
  const withDebt = shown.filter((i) => i.s.ending_debt > 0).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await addManualEntry(Number(mVehicle), "MANUAL_DEBT", mDay, Number(mAmount), mNote.trim());
      setNotice("Deni limeongezwa.");
      setMAmount(""); setMNote(""); setAdding(false);
      load();
    } catch (err) { setError((err as Error).message); }
  }

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
        <button className="btn-add" onClick={load}>Tafuta</button>
        <button className="btn-green-wide" onClick={() => setAdding((v) => !v)}>{adding ? "Funga" : "Ongeza Deni"}</button>
      </section>

      {adding && (
        <section className="card form-card">
          <form onSubmit={submit}>
            <h3>Ongeza Deni</h3>
            <label>Chombo
              <select value={mVehicle} onChange={(e) => setMVehicle(e.target.value)} required>
                <option value="">Chagua chombo</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label>Tarehe<input type="date" value={mDay} onChange={(e) => setMDay(e.target.value)} required /></label>
            <label>Kiasi (TSh)<input type="number" inputMode="numeric" value={mAmount} onChange={(e) => setMAmount(e.target.value)} required min={1} /></label>
            <label>Maelezo<input value={mNote} onChange={(e) => setMNote(e.target.value)} /></label>
            <button type="submit">Hifadhi</button>
          </form>
        </section>
      )}

      <section className="card">
        <h3>Muhtasari wa Deni · {monthLabel(fMonth)}</h3>
        <div className="kv-grid">
          <div><span>TOTAL DEBT</span><b className="red">{tsh(ending)}</b></div>
          <div><span>WEEKLY TARGET</span><b className="blue">{tsh(weekly)}</b></div>
          <div><span>VEHICLES WITH DEBT</span><b className="orange">{withDebt}/{shown.length}</b></div>
          <div><span>MALIPO</span><b className="green">{tsh(paid)}</b></div>
        </div>
      </section>

      <section className="card">
        <h3>Dashibodi ya Deni</h3>
        <div className="kv-grid">
          <div><span>CARRY OVER DEBT</span><b className="orange">{tsh(carry)}</b></div>
          <div><span>RUNNING DEBT (MWEZI HUU)</span><b className="red">{tsh(added)}</b></div>
          <div><span>TOTAL DEBT</span><b className="red">{tsh(carry + added - paid)}</b></div>
        </div>
      </section>

      <section className="card">
        <h3>Debt Details</h3>
        {shown.length === 0 && <p className="empty">Hakuna magari</p>}
        {shown.map((i) => {
          const target = i.s.weekly_target * 4 || 1;
          const generated = (i.s.debt_added / target) * 100;
          const due = i.s.starting_debt + i.s.debt_added;
          const paidPct = due > 0 ? (i.s.payments / due) * 100 : 0;
          return (
            <article key={i.vehicle.id} className="debt-item">
              <div className="debt-head">
                <b>{i.vehicle.name}</b>
                <span className="badge type">{i.vehicle.vehicle_type.toUpperCase()}</span>
                <span className="debt-amount red">{tsh(i.s.ending_debt)}</span>
              </div>
              <p className="driver">Weekly Target: {tsh(i.s.weekly_target)} · Carry: {tsh(i.s.starting_debt)}</p>
              <Bar label="Deni lililotengenezwa mwezi huu (kwa target ya mwezi)" percent={generated} color="#ef4444" />
              <Bar label="Ulipwaji wa deni" percent={paidPct} color="#10b981" />
            </article>
          );
        })}
      </section>
    </>
  );
}
