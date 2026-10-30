import { useEffect, useState } from "react";
import { updateVehicle } from "./api";
import type { Vehicle } from "./types";

// Shown on the Income tab: the date range in which income is expected.
export default function IncomePeriod({ vehicle, onChanged }: { vehicle: Vehicle; onChanged: () => void }) {
  const [start, setStart] = useState(vehicle.income_start ?? "");
  const [end, setEnd] = useState(vehicle.income_end ?? "");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setStart(vehicle.income_start ?? "");
    setEnd(vehicle.income_end ?? "");
  }, [vehicle.id, vehicle.income_start, vehicle.income_end]);

  async function save() {
    setErr(""); setMsg("");
    if (start && end && start > end) { setErr("Tarehe ya kuanza iwe kabla ya ya mwisho."); return; }
    try {
      await updateVehicle(vehicle.id, { income_start: start || null, income_end: end || null });
      setMsg("Kipindi cha mapato kimehifadhiwa.");
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <section className="card">
      <h3>Kipindi cha Mapato</h3>
      <div className="target-panel">
        <label>Tarehe ya kuanza<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Tarehe ya mwisho<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <div className="btn-row"><button type="button" onClick={save}>Hifadhi kipindi</button></div>
      </div>
      <p className="hint">Wiki nje ya kipindi hiki hazihesabiwi kwenye deni wala target.</p>
      {msg && <p className="notice">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </section>
  );
}
