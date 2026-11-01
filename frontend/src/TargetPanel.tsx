import { useEffect, useState } from "react";
import { getWeekPlan, saveWeekPlan, updateVehicle, type WeekPlan } from "./api";
import { PRESETS } from "./VehiclesPage";
import { tsh } from "./format";
import type { Vehicle } from "./types";

const DAYS = ["Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi", "Jumapili"];

function sameDays(a: number[], b: number[]): boolean {
  return [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();
}

export default function TargetPanel({ vehicle, month: startMonth, onSaved }: {
  vehicle: Vehicle;
  month: string;
  onSaved: () => void;
}) {
  const baseDays = vehicle.active_days ?? Array.from({ length: vehicle.working_days_count }, (_, i) => i);

  const [month, setMonth] = useState(startMonth);
  const [week, setWeek] = useState(1);
  const [weeks, setWeeks] = useState<WeekPlan[]>([]);
  const [days, setDays] = useState<number[]>(baseDays);
  const [manual, setManual] = useState("");
  const [name, setName] = useState(vehicle.name);
  const [type] = useState(vehicle.vehicle_type);
  const [daily, setDaily] = useState(String(vehicle.daily_target));
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const current = weeks.find((w) => w.week_number === week);

  async function loadPlan(m: string) {
    try {
      const r = await getWeekPlan(vehicle.id, m);
      setWeeks(r.weeks);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => { loadPlan(month); }, [vehicle.id, month]);

  // When the week or the loaded plan changes, show that week's saved settings.
  useEffect(() => {
    const w = weeks.find((x) => x.week_number === week);
    if (!w) return;
    setDays(w.active_days);
    setManual(w.manual_target == null ? "" : String(w.manual_target));
  }, [weeks, week]);

  const dailyNum = Number(daily) || 0;
  const autoPreview = dailyNum * Math.max(0, days.length - (current?.lost_days ?? 0));
  const shownTarget = manual.trim() ? Number(manual) : autoPreview;
  const monthTarget = weeks.reduce((a, w) => (w.in_income_period ? a + w.target : a), 0);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  }

  async function saveWeek() {
    setErr(""); setMsg("");
    if (days.length === 0) { setErr("Chagua angalau siku moja ya kufanya kazi."); return; }
    try {
      const r = await saveWeekPlan(vehicle.id, {
        month,
        week_number: week,
        // Same as the vehicle's default days -> store null so the week follows the vehicle.
        active_days: sameDays(days, baseDays) ? null : days,
        target: manual.trim() === "" ? null : Number(manual),
      });
      setWeeks(r.weeks);
      setMsg(`Wiki ${week} imehifadhiwa.`);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function resetWeek() {
    setErr(""); setMsg("");
    try {
      const r = await saveWeekPlan(vehicle.id, { month, week_number: week, active_days: null, target: null });
      setWeeks(r.weeks);
      setMsg(`Wiki ${week} imerudi kiotomatiki.`);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function saveVehicle() {
    setErr(""); setMsg("");
    const preset = PRESETS.find((p) => p.key === type);
    const typeChanged = type !== vehicle.vehicle_type;
    try {
      await updateVehicle(vehicle.id, {
        name: name.trim().toUpperCase(),
        vehicle_type: type,
        daily_target: Number(daily),
        ...(typeChanged && preset
          ? { active_days: Array.from({ length: preset.days }, (_, i) => i) }
          : {}),
      });
      setMsg("Gari limebadilishwa.");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="target-panel">
      <h4>Gari</h4>
      <label>Vehicle Number / Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Day Target (TSh)
        <input type="number" inputMode="numeric" min={1} value={daily} onChange={(e) => setDaily(e.target.value)} />
      </label>
      <div className="btn-row">
        <button type="button" className="ghost" onClick={saveVehicle}>Hifadhi gari</button>
      </div>

      <h4>Mwezi na Wiki</h4>
      <label>Mwezi<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
      <div className="week-tabs">
        {weeks.map((w) => (
          <button type="button" key={w.week_number}
            className={w.week_number === week ? "active" : ""}
            onClick={() => setWeek(w.week_number)}>
            Wiki {w.week_number}
          </button>
        ))}
      </div>
      {current && (
        <p className="hint">
          {current.start} hadi {current.end}
          {!current.in_income_period && " · Nje ya kipindi cha mapato (haihesabiwi)"}
        </p>
      )}

      <h4>Siku za kufanya kazi (bonyeza kuzima/kuwasha)</h4>
      <div className="day-toggles">
        {DAYS.map((label, d) => (
          <button type="button" key={d} className={days.includes(d) ? "on" : "off"} onClick={() => toggleDay(d)}>
            {label.slice(0, 3)}
          </button>
        ))}
      </div>
      <p className="hint">Siku za kazi wiki hii: {days.length}</p>

      <label>Target ya wiki hii (hiari, andika kwa nusu siku)
        <input type="number" inputMode="numeric" min={1}
          placeholder={`Kiotomatiki: ${tsh(autoPreview)}`}
          value={manual} onChange={(e) => setManual(e.target.value)} />
      </label>
      <p className="hint">Target ya wiki hii: <b>{tsh(shownTarget)}</b></p>

      <div className="btn-row">
        <button type="button" onClick={saveWeek}>Hifadhi wiki {week}</button>
        <button type="button" className="ghost" onClick={resetWeek}>Rudisha kiotomatiki</button>
      </div>

      <h4>Muhtasari wa mwezi</h4>
      <table>
        <thead><tr><th>Wiki</th><th>Siku</th><th>Target</th><th>Chanzo</th></tr></thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week_number} className={w.in_income_period ? "" : "muted"}>
              <td>{w.week_number}</td>
              <td>{w.active_days.length}</td>
              <td>{tsh(w.target)}</td>
              <td>{w.manual_target == null ? "Auto" : "Manual"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><b>Target ya mwezi: {tsh(monthTarget)}</b></p>

      {msg && <p className="notice">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
