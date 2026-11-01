import { useEffect, useState } from "react";
import { getWeekPlan, saveWeekPlan, updateVehicle, type WeekPlan } from "./api";
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState<number[]>(baseDays);
  const [manual, setManual] = useState("");
  const [daily, setDaily] = useState(String(vehicle.daily_target));
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const current = weeks.find((w) => w.week_number === week);
  const dailyNum = Number(daily) || 0;
  const autoTarget = dailyNum * Math.max(0, days.length - (current?.lost_days ?? 0));
  const shownTarget = manual.trim() ? Number(manual) : autoTarget;

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
    setStartDate(w.start);
    setEndDate(w.end);
  }, [weeks, week]);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  }

  async function saveWeek() {
    setErr(""); setMsg("");
    if (days.length === 0) { setErr("Chagua angalau siku moja ya kufanya kazi."); return; }
    if (startDate && endDate && endDate < startDate) { setErr("Tarehe ya mwisho iwe baada ya tarehe ya kuanza."); return; }
    try {
      const r = await saveWeekPlan(vehicle.id, {
        month,
        week_number: week,
        active_days: sameDays(days, baseDays) ? null : days,
        target: manual.trim() === "" ? null : Number(manual),
        start_date: startDate || null,
        end_date: endDate || null,
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
      const r = await saveWeekPlan(vehicle.id, {
        month, week_number: week, active_days: null, target: null, start_date: null, end_date: null,
      });
      setWeeks(r.weeks);
      setMsg(`Wiki ${week} imerudi kiotomatiki.`);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function saveDayTarget() {
    setErr(""); setMsg("");
    try {
      await updateVehicle(vehicle.id, {
        name: vehicle.name,
        vehicle_type: vehicle.vehicle_type,
        daily_target: Number(daily),
      });
      setMsg("Day target imehifadhiwa.");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="target-panel">
      <h4>Set Target</h4>

      <label>Month
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </label>

      <label>Week
        <select className="tp-week" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
          {weeks.map((w) => (
            <option key={w.week_number} value={w.week_number}>Wiki {w.week_number}</option>
          ))}
        </select>
      </label>

      <label>Start Date
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>

      <label>End Date
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </label>

      <h4>Working Days</h4>
      <div className="tp-days">
        {DAYS.map((label, d) => (
          <button type="button" key={d} className={days.includes(d) ? "tp-day on" : "tp-day off"} onClick={() => toggleDay(d)}>
            {label}
          </button>
        ))}
      </div>
      <p className="hint">Working days this week: {days.length}</p>

      <label>Day Target (TSh)
        <input type="number" inputMode="numeric" min={1} value={daily} onChange={(e) => setDaily(e.target.value)} />
      </label>

      <label>Week Target (TSh)
        <input type="number" inputMode="numeric" min={1}
          placeholder={`Automatic: ${tsh(autoTarget)}`}
          value={manual} onChange={(e) => setManual(e.target.value)} />
      </label>
      <p className="hint">Week target: <b>{tsh(shownTarget)}</b></p>

      <div className="btn-row">
        <button type="button" onClick={saveWeek}>Save week {week}</button>
        <button type="button" className="ghost" onClick={resetWeek}>Reset automatic</button>
        <button type="button" className="ghost" onClick={saveDayTarget}>Save day target</button>
      </div>

      {msg && <p className="notice">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
