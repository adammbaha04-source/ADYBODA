import { useEffect, useState, type FormEvent } from "react";
import { changeDriver, createVehicle, getDebt } from "./api";
import { monthLabel, todayYMD, tsh } from "./format";
import type { DebtSummary, Vehicle } from "./types";

// Presets copied from the old app's "Vehicle Type" dropdown.
export const PRESETS = [
  { key: "Bajaj", label: "Bajaj (6 days · 16,000/day)", days: 6, daily: 16000 },
  { key: "Bodaboda", label: "Bodaboda (7 days · 10,000/day)", days: 7, daily: 10000 },
];

export function AddVehicleForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [presetKey, setPresetKey] = useState("Bajaj");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [startDate, setStartDate] = useState(todayYMD());
  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];
  const [weekly, setWeekly] = useState(String(preset.daily * preset.days));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function pickPreset(key: string) {
    setPresetKey(key);
    const p = PRESETS.find((x) => x.key === key) ?? PRESETS[0];
    setWeekly(String(p.daily * p.days));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const daily = Math.round(Number(weekly) / preset.days) || preset.daily;
      const v = await createVehicle(name.trim().toUpperCase(), daily, preset.days, preset.key);
      if (driverName.trim()) await changeDriver(v.id, driverName.trim(), driverPhone.trim(), startDate);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card add-form" onSubmit={submit}>
      <h3>Add New Vehicle</h3>
      <label>Vehicle Number / Name *
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MC 123 ABC" required />
      </label>
      <label>Vehicle Type *
        <select value={presetKey} onChange={(e) => pickPreset(e.target.value)}>
          {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </label>
      <p className="hint">
        Bajaj hufanya kazi siku 6 kwa wiki (Mon–Sat). Bodaboda hufanya kazi siku 7 kwa wiki.
      </p>
      <label>Driver Name (Optional)
        <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver full name" />
      </label>
      <label>Driver Phone (Optional)
        <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="e.g. 0712345678" />
      </label>
      <label>Driver Start Date (tarehe dereva alipoanza)
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>
      <label>Weekly Target (TSh)
        <input type="number" inputMode="numeric" value={weekly} onChange={(e) => setWeekly(e.target.value)} required min={1} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={busy}>{busy ? "Inahifadhi..." : "Hifadhi / Save Vehicle"}</button>
        <button type="button" className="ghost" onClick={onCancel}>Sitisha / Cancel</button>
      </div>
    </form>
  );
}

export function VehicleCard(props: {
  vehicle: Vehicle; month: string; tick: number; onOpen: () => void; onDelete: () => void;
}) {
  const { vehicle, month, tick, onOpen, onDelete } = props;
  const [s, setS] = useState<DebtSummary | null>(null);

  useEffect(() => {
    let alive = true;
    getDebt(vehicle.id, month).then((d) => { if (alive) setS(d.summary); }).catch(() => {});
    return () => { alive = false; };
  }, [vehicle.id, month, tick]);

  const latest = [...vehicle.driver_periods].sort((a, b) => a.from_date.localeCompare(b.from_date)).pop();
  const driverText = latest && latest.driver_name
    ? `Driver: ${latest.driver_name}${latest.phone ? " • " + latest.phone : ""}`
    : "Hakuna dereva";
  const monthTarget = s ? s.weekly_target * 4 : 0;

  return (
    <article className="vcard" onClick={onOpen}>
      <div className="vhead">
        <div className="vtitle">
          <h3>{vehicle.name}</h3>
          <span className="badge type">{vehicle.vehicle_type.toUpperCase()}</span>
          <span className="badge month">{monthLabel(month)}</span>
        </div>
        <div className="vactions">
          <button className="icon" aria-label="Fungua" onClick={(e) => { e.stopPropagation(); onOpen(); }}>✏️</button>
          <button className="icon" aria-label="Futa" onClick={(e) => { e.stopPropagation(); onDelete(); }}>🗑️</button>
        </div>
      </div>
      <p className="driver">{driverText}</p>
      {s ? (
        <>
          <div className="block">
            <div className="block-title">MONTH</div>
            <div className="row-line"><span>Target:</span><b className="blue">{tsh(monthTarget)}</b></div>
            <div className="row-line"><span>Paid:</span><b className="green">{tsh(s.payments)}</b></div>
          </div>
          <div className="row-line"><span>Month Debt:</span><b className="orange">{tsh(s.debt_added)}</b></div>
          <div className="row-line"><span>Carry Over Debt:</span><b className="orange">{tsh(s.starting_debt)}</b></div>
          <div className="total"><span>Total Debt:</span><b>{tsh(s.ending_debt)}</b></div>
        </>
      ) : (
        <p className="driver">Inapakia...</p>
      )}
    </article>
  );
}

export default function VehiclesPage(props: {
  vehicles: Vehicle[]; month: string; tick: number;
  onOpen: (v: Vehicle) => void; onDelete: (v: Vehicle) => void; onAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      {adding ? (
        <AddVehicleForm
          onSaved={() => { setAdding(false); props.onAdded(); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className="btn-add" onClick={() => setAdding(true)}>+ Add Vehicle</button>
      )}
      {props.vehicles.length === 0 && !adding && (
        <p className="card">Hakuna gari bado. Bonyeza + Add Vehicle.</p>
      )}
      {props.vehicles.map((v) => (
        <VehicleCard
          key={v.id}
          vehicle={v}
          month={props.month}
          tick={props.tick}
          onOpen={() => props.onOpen(v)}
          onDelete={() => props.onDelete(v)}
        />
      ))}
    </>
  );
}
