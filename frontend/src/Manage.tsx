import { useState, type FormEvent } from "react";
import { addLostDays, addManualEntry, changeDriver, createVehicle } from "./api";
import { currentMonth } from "./format";

interface Props {
  vehicleId: number | null;
  onChanged: () => void;       // refresh the debt view
  onVehicleCreated: () => void; // reload the vehicle list
}

export default function Manage({ vehicleId, onChanged, onVehicleCreated }: Props) {
  const [msg, setMsg] = useState("");

  const [vName, setVName] = useState("");
  const [vTarget, setVTarget] = useState("16000");
  const [vDays, setVDays] = useState("6");

  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dFrom, setDFrom] = useState(`${currentMonth()}-01`);

  const [lMonth, setLMonth] = useState(currentMonth());
  const [lWeek, setLWeek] = useState("1");
  const [lDays, setLDays] = useState("1");

  const [mKind, setMKind] = useState("MANUAL_PAYMENT");
  const [mDay, setMDay] = useState(`${currentMonth()}-01`);
  const [mAmount, setMAmount] = useState("");
  const [mNote, setMNote] = useState("");

  async function run(action: () => Promise<unknown>, ok: string, after?: () => void) {
    try {
      await action();
      setMsg(ok);
      after?.();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  function submitVehicle(e: FormEvent) {
    e.preventDefault();
    run(() => createVehicle(vName.trim().toUpperCase(), Number(vTarget), Number(vDays)),
        "Gari limeongezwa.", () => { setVName(""); onVehicleCreated(); });
  }

  function submitDriver(e: FormEvent) {
    e.preventDefault();
    if (vehicleId === null) return;
    run(() => changeDriver(vehicleId, dName.trim(), dPhone.trim(), dFrom),
        "Dereva amebadilishwa. Deni la dereva wa zamani limefungwa.", () => { setDName(""); setDPhone(""); onChanged(); });
  }

  function submitLost(e: FormEvent) {
    e.preventDefault();
    if (vehicleId === null) return;
    run(() => addLostDays(vehicleId, lMonth, Number(lWeek), Number(lDays)), "Siku zimehifadhiwa.", onChanged);
  }

  function submitManual(e: FormEvent) {
    e.preventDefault();
    if (vehicleId === null) return;
    run(() => addManualEntry(vehicleId, mKind, mDay, Number(mAmount), mNote.trim()),
        "Imehifadhiwa.", () => { setMAmount(""); setMNote(""); onChanged(); });
  }

  return (
    <section className="card">
      <h3>Usimamizi</h3>
      {msg && <p className="notice">{msg}</p>}

      <details>
        <summary>Gari jipya</summary>
        <form className="row wrap-row" onSubmit={submitVehicle}>
          <input placeholder="Namba ya gari" value={vName} onChange={(e) => setVName(e.target.value)} required />
          <input type="number" inputMode="numeric" placeholder="Target ya siku" value={vTarget} onChange={(e) => setVTarget(e.target.value)} required />
          <input type="number" min={1} max={7} value={vDays} onChange={(e) => setVDays(e.target.value)} required />
          <button type="submit">Ongeza gari</button>
        </form>
      </details>

      <details>
        <summary>Badili dereva</summary>
        <form className="row wrap-row" onSubmit={submitDriver}>
          <input placeholder="Jina la dereva mpya" value={dName} onChange={(e) => setDName(e.target.value)} required />
          <input placeholder="Simu" value={dPhone} onChange={(e) => setDPhone(e.target.value)} />
          <input type="date" value={dFrom} onChange={(e) => setDFrom(e.target.value)} required />
          <button type="submit" disabled={vehicleId === null}>Hifadhi dereva</button>
        </form>
      </details>

      <details>
        <summary>Siku zilizopotea</summary>
        <form className="row wrap-row" onSubmit={submitLost}>
          <input type="month" value={lMonth} onChange={(e) => setLMonth(e.target.value)} required />
          <input type="number" min={1} max={5} value={lWeek} onChange={(e) => setLWeek(e.target.value)} required />
          <input type="number" min={1} max={7} value={lDays} onChange={(e) => setLDays(e.target.value)} required />
          <button type="submit" disabled={vehicleId === null}>Hifadhi</button>
        </form>
      </details>

      <details>
        <summary>Malipo au deni la mkono</summary>
        <form className="row wrap-row" onSubmit={submitManual}>
          <select value={mKind} onChange={(e) => setMKind(e.target.value)}>
            <option value="MANUAL_PAYMENT">Malipo ya deni</option>
            <option value="MANUAL_DEBT">Kakopa deni</option>
            <option value="CARRY_OVER">Deni la mwanzo (carry-over)</option>
          </select>
          <input type="date" value={mDay} onChange={(e) => setMDay(e.target.value)} required />
          <input type="number" inputMode="numeric" placeholder="Kiasi" value={mAmount} onChange={(e) => setMAmount(e.target.value)} required min={0} />
          <input placeholder="Maelezo" value={mNote} onChange={(e) => setMNote(e.target.value)} />
          <button type="submit" disabled={vehicleId === null}>Hifadhi</button>
        </form>
      </details>
    </section>
  );
}
