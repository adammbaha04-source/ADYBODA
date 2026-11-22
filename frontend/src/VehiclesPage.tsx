import { useEffect, useState, type FormEvent } from "react";
import { changeDriver, createVehicle, getDebtSummaries, updateVehicle, type DebtBundle } from "./api";
import { listAllLostDays } from "./api_extra";
import DriverSection from "./DriverSection";
import FleetCard, { FleetCardSkeleton } from "./FleetCard";
import { shortDate, todayYMD, tsh } from "./format";
import type { DebtEntry, DebtSummary, LostDays, Vehicle } from "./types";

// Vehicle types. The owner types the amount per day and the working days per week.
export const PRESETS = [
  { key: "Bajaj", label: "Bajaj", days: 6, daily: 16000, hint: "Hufanya kazi Jumatatu–Jumamosi (siku 6)" },
  { key: "Bodaboda", label: "Bodaboda", days: 7, daily: 10000, hint: "Hufanya kazi siku zote 7 za wiki" },
];

export interface PeriodSel { mode: "month" | "week"; week: number; }

const WEEK_RE = /Week (\d+): Income (\d+) vs Target (\d+)/;
const WEEK_TYPES = ["WEEKLY_DEFICIT", "WEEKLY_EXCESS", "EXCESS_PAYMENT", "NO_CHANGE"];

// Kumbukumbu ya mwisho (memory) ili kadi zionekane papo hapo ukirudi kwenye ukurasa huu.
const cache: { debt: Record<string, DebtBundle[]>; lost: LostDays[] | null } = { debt: {}, lost: null };

function weekRowOf(entries: DebtEntry[], week: number) {
  for (const e of entries) {
    if (!WEEK_TYPES.includes(e.type)) continue;
    const m = e.notes.match(WEEK_RE);
    if (m && Number(m[1]) === week) return { start: e.date, income: Number(m[2]), target: Number(m[3]), remaining: e.remaining_debt };
  }
  return null;
}

// ---------- Add vehicle ----------
export function AddVehicleForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Bajaj");
  const preset = PRESETS.find((p) => p.key === type) ?? PRESETS[0];
  const [amount, setAmount] = useState(String(preset.daily));
  const [days, setDays] = useState(String(preset.days));
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [startDate, setStartDate] = useState(todayYMD());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function pickType(key: string) {
    const p = PRESETS.find((x) => x.key === key) ?? PRESETS[0];
    setType(key); setAmount(String(p.daily)); setDays(String(p.days));
  }

  const weekly = (Number(amount) || 0) * (Number(days) || 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const d = Number(days);
    if (!d || d < 1 || d > 7) { setError("Siku za kazi kwa wiki ziwe kati ya 1 na 7."); return; }
    setBusy(true); setError("");
    try {
      const v = await createVehicle(name.trim().toUpperCase(), Number(amount), d, type);
      if (driverName.trim()) await changeDriver(v.id, driverName.trim(), driverPhone.trim(), startDate);
      onSaved();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form className="card add-form" onSubmit={submit}>
      <h3>Ongeza Gari</h3>
      <label>Namba ya gari *<input value={name} onChange={(e) => setName(e.target.value)} placeholder="mfano: MC 123 ABC" required /></label>
      <div className="type-pick">
        {PRESETS.map((p) => (
          <label key={p.key} className={type === p.key ? "on" : ""}>
            <input type="radio" name="vtype" checked={type === p.key} onChange={() => pickType(p.key)} />
            <span>{p.label}</span>
            <small>{p.hint}</small>
          </label>
        ))}
      </div>
      <label>Kiasi kwa siku (TSh) *<input type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
      <label>Siku za kufanya kazi kwa wiki *<input type="number" inputMode="numeric" min={1} max={7} value={days} onChange={(e) => setDays(e.target.value)} required /></label>
      <p className="week-preview">Target ya wiki: {tsh(weekly)}</p>
      <label>Jina la dereva (si lazima)<input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Jina kamili" /></label>
      <label>Simu ya dereva (si lazima)<input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} inputMode="tel" placeholder="0712345678" /></label>
      <label>Tarehe dereva alipoanza<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={busy}>{busy ? "Inahifadhi..." : "Hifadhi Gari"}</button>
        <button type="button" className="ghost" onClick={onCancel}>Sitisha</button>
      </div>
    </form>
  );
}

// ---------- Edit vehicle (inline, opened by Edit button) ----------
// Vehicle fields on top, then the driver section (Hariri dereva / Badili dereva).
function EditVehicleInline({
  vehicle, onSaved, onClose, onRefresh,
}: { vehicle: Vehicle; onSaved: () => void; onClose: () => void; onRefresh: () => void }) {
  const [name, setName] = useState(vehicle.name);
  const [type, setType] = useState(vehicle.vehicle_type);
  const [amount, setAmount] = useState(String(vehicle.daily_target));
  const [days, setDays] = useState(String(vehicle.working_days_count));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await updateVehicle(vehicle.id, {
        name: name.trim().toUpperCase(), vehicle_type: type,
        daily_target: Number(amount), working_days_count: Number(days),
      });
      onSaved();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="vehicle-edit" onClick={(e) => e.stopPropagation()}>
      <form className="inline-edit" onSubmit={save}>
        <label>Namba ya gari<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <div className="type-pick">
          {PRESETS.map((p) => (
            <label key={p.key} className={type === p.key ? "on" : ""}>
              <input type="radio" name={"edit-" + vehicle.id} checked={type === p.key} onChange={() => setType(p.key)} />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
        <label>Kiasi kwa siku (TSh)<input type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
        <label>Siku za kazi kwa wiki<input type="number" inputMode="numeric" min={1} max={7} value={days} onChange={(e) => setDays(e.target.value)} required /></label>
        <p className="week-preview">Target ya wiki: {tsh((Number(amount) || 0) * (Number(days) || 0))}</p>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={busy}>{busy ? "Inahifadhi..." : "Hifadhi"}</button>
          <button type="button" className="ghost" onClick={onClose}>Funga</button>
        </div>
      </form>

      <DriverSection vehicle={vehicle} onSaved={onRefresh} />
    </div>
  );
}

// ---------- Vehicle card ----------
// Taarifa (deni + siku za hasara) zinaletwa na orodha kwa ombi moja, kisha kila kadi inazitumia.
export function VehicleCard(props: {
  vehicle: Vehicle; month: string; period: PeriodSel;
  bundle?: DebtBundle; lost: LostDays[];
  onOpen: () => void; onDelete: () => void; onUpdated: () => void; canManage: boolean;
  index?: number;
}) {
  const { vehicle, month, period, bundle, lost, onOpen, onDelete, onUpdated, canManage } = props;
  const [editing, setEditing] = useState(false);

  const s: DebtSummary | null = bundle?.summary ?? null;
  const entries: DebtEntry[] = bundle?.entries ?? [];
  const lostDays = lost
    .filter((r) => r.vehicle === vehicle.id && r.month === month && (period.mode === "month" || r.week_number === period.week))
    .reduce((sum, r) => sum + (Number(r.days) || 0), 0);

  const latest = [...vehicle.driver_periods].sort((a, b) => a.from_date.localeCompare(b.from_date)).pop();
  const monthTarget = s ? s.weekly_target * (vehicle.include_week5 ? 5 : 4) : 0;
  const week = period.mode === "week" ? weekRowOf(entries, period.week) : null;
  const dashboardTarget = period.mode === "week"
    ? (week?.target ?? vehicle.daily_target * vehicle.working_days_count)
    : monthTarget;
  const dashboardPaid = period.mode === "week" ? (week?.income ?? 0) : (s?.payments ?? 0);
  const dashboardDebt = s?.ending_debt ?? 0;
  const totalDays = vehicle.working_days_count * (period.mode === "week" ? 1 : (vehicle.include_week5 ? 5 : 4));

  return (
    <>
      {!s && <FleetCardSkeleton index={props.index ?? 0} />}

      {s && (
        <FleetCard
          vehicle={vehicle}
          index={props.index ?? 0}
          driverName={latest?.driver_name ?? ""}
          driverPhone={latest?.phone ?? ""}
          target={dashboardTarget}
          paid={dashboardPaid}
          debt={dashboardDebt}
          lostDays={lostDays}
          totalDays={totalDays}
          canManage={canManage}
          onOpen={onOpen}
          onRecord={onOpen}
          onEdit={() => setEditing((v) => !v)}
          onDelete={onDelete}
        />
      )}

      {canManage && editing && (
        <EditVehicleInline
          vehicle={vehicle}
          onSaved={() => { setEditing(false); onUpdated(); }}
          onClose={() => setEditing(false)}
          onRefresh={onUpdated}
        />
      )}

      {s && period.mode === "week" && (
        <div className="week-block">
          <div className="wb-title">WEEK {period.week}</div>
          {week ? (
            <>
              <div className="wb-range">{shortDate(week.start)} – {shortDate(addDaysLocal(week.start, vehicle.working_days_count - 1))}</div>
              <div className="row-line"><span>Target ya wiki:</span><b className="blue">{tsh(week.target)}</b></div>
              <div className="row-line"><span>Imekusanywa:</span><b className="green">{tsh(week.income)}</b></div>
              <div className="row-line"><span>Imebaki:</span><b className="red">{tsh(week.remaining)}</b></div>
            </>
          ) : <p className="driver">Hakuna data ya Week {period.week} mwezi huu</p>}
        </div>
      )}
    </>
  );
}

function addDaysLocal(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// ---------- List ----------
export default function VehiclesPage(props: {
  vehicles: Vehicle[]; canManage: boolean; month: string; tick: number; period: PeriodSel;
  onMonthChange?: (month: string) => void;
  onPeriodModeChange?: (mode: "month" | "week") => void;
  onWeekChange?: (week: number) => void;
  onOpen: (v: Vehicle) => void; onDelete: (v: Vehicle) => void; onAdded: () => void; onUpdated: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [bundles, setBundles] = useState<DebtBundle[] | null>(cache.debt[props.month] ?? null);
  const [lost, setLost] = useState<LostDays[]>(cache.lost ?? []);

  // Ombi MOJA kwa magari yote (si ombi kwa kila gari). Kumbukumbu ya zamani inaonekana papo hapo.
  useEffect(() => {
    let alive = true;
    setBundles(cache.debt[props.month] ?? null);
    getDebtSummaries(props.month)
      .then((d) => { cache.debt[props.month] = d; if (alive) setBundles(d); })
      .catch(() => { /* tunaendelea kuonyesha tulichonacho */ });
    listAllLostDays()
      .then((r) => { cache.lost = r; if (alive) setLost(r); })
      .catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, [props.month, props.tick, props.vehicles.length]);

  return (
    <>
      {props.canManage && (adding ? (
        <AddVehicleForm onSaved={() => { setAdding(false); props.onAdded(); }} onCancel={() => setAdding(false)} />
      ) : (
        <button className="btn-add" onClick={() => setAdding(true)}>+ Ongeza Gari</button>
      ))}
      {props.vehicles.length === 0 && !adding && <p className="card">Hakuna gari bado. Bonyeza + Ongeza Gari.</p>}
      {props.vehicles.map((v, i) => (
        <VehicleCard
          key={v.id}
          index={i}
          vehicle={v}
          month={props.month}
          period={props.period}
          bundle={bundles?.find((b) => b.vehicle_id === v.id)}
          lost={lost}
          onOpen={() => props.onOpen(v)}
          onDelete={() => props.onDelete(v)}
          onUpdated={props.onUpdated}
          canManage={props.canManage}
        />
      ))}
    </>
  );
}
