import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createReturn, deleteReturn, getDebt, listReturns, listVehicles, setCarry } from "./api";
import { currentMonth, tsh } from "./format";
import Manage from "./Manage";
import type { DebtResponse, ReturnRecord, Vehicle } from "./types";

export default function Dashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [debt, setDebt] = useState<DebtResponse | null>(null);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [error, setError] = useState("");

  const [day, setDay] = useState(`${currentMonth()}-01`);
  const [amount, setAmount] = useState("");
  const [excess, setExcess] = useState(false);

  const loadVehicles = useCallback(() => {
    listVehicles()
      .then((v) => { setVehicles(v); setVehicleId((cur) => cur ?? (v.length ? v[0].id : null)); })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const refresh = useCallback(async () => {
    if (vehicleId === null) return;
    try {
      const [d, r] = await Promise.all([getDebt(vehicleId, month), listReturns(vehicleId)]);
      setDebt(d);
      setReturns(r.filter((x) => x.day.startsWith(month)).sort((a, b) => b.day.localeCompare(a.day)));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [vehicleId, month]);

  useEffect(() => { refresh(); }, [refresh]);

  async function addReturn(e: FormEvent) {
    e.preventDefault();
    if (vehicleId === null || !amount) return;
    try {
      await createReturn(vehicleId, day, Number(amount), excess);
      setAmount("");
      setExcess(false);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleCarry(on: boolean) {
    if (vehicleId === null) return;
    await setCarry(vehicleId, month, on);
    refresh();
  }

  async function removeReturn(id: number) {
    if (!confirm("Futa mapato haya?")) return;
    await deleteReturn(id);
    refresh();
  }

  const s = debt?.summary;

  return (
    <div className="wrap">
      <header>
        <h1>AdyBajaj</h1>
        <div className="row">
          <select value={vehicleId ?? ""} onChange={(e) => setVehicleId(Number(e.target.value))}>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {s && (
        <>
          <section className="grid">
            <div className="card"><h4>Deni la mwanzo</h4><b>{tsh(s.starting_debt)}</b></div>
            <div className="card"><h4>Deni jipya</h4><b className="red">{tsh(s.debt_added)}</b></div>
            <div className="card"><h4>Malipo</h4><b className="green">{tsh(s.payments)}</b></div>
            <div className="card"><h4>Deni la mwisho</h4><b className="red">{tsh(s.ending_debt)}</b></div>
            <div className="card"><h4>Target ya wiki</h4><b>{tsh(s.weekly_target)}</b></div>
          </section>

          <label className="card toggle">
            <input type="checkbox" checked={s.carry_over_on} onChange={(e) => toggleCarry(e.target.checked)} />
            Deni la mwezi huu lipelekwe mwezi unaofuata (Carry over)
          </label>

          <section className="card">
            <h3>Historia ya deni</h3>
            <div className="scroll">
              <table>
                <thead>
                  <tr><th>Tarehe</th><th>Aina</th><th>Awali</th><th>Mpya</th><th>Imelipwa</th><th>Imefungwa</th><th>Baada</th><th>Maelezo</th></tr>
                </thead>
                <tbody>
                  {debt!.entries.length === 0 && <tr><td colSpan={8}>Hakuna historia kwa mwezi huu</td></tr>}
                  {debt!.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{e.date}</td><td>{e.type}</td>
                      <td>{tsh(e.previous_debt)}</td><td>{tsh(e.new_debt)}</td>
                      <td>{tsh(e.paid_debt)}</td><td>{tsh(e.closed_debt)}</td>
                      <td>{tsh(e.remaining_debt)}</td><td className="notes">{e.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="card">
        <h3>Ongeza mapato</h3>
        <form className="row wrap-row" onSubmit={addReturn}>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
          <input type="number" inputMode="numeric" placeholder="Kiasi" value={amount} onChange={(e) => setAmount(e.target.value)} required min={0} />
          <label className="inline"><input type="checkbox" checked={excess} onChange={(e) => setExcess(e.target.checked)} /> Ziada</label>
          <button type="submit">Hifadhi</button>
        </form>
        <ul className="list">
          {returns.map((r) => (
            <li key={r.id}>
              <span>{r.day} {r.is_excess && "(ziada)"}</span>
              <b>{tsh(r.amount)}</b>
              <button className="danger" onClick={() => removeReturn(r.id)}>Futa</button>
            </li>
          ))}
        </ul>
      </section>

      <Manage vehicleId={vehicleId} onChanged={refresh} onVehicleCreated={loadVehicles} />
    </div>
  );
}
