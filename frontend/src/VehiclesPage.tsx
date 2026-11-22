import { useEffect, useState, type FormEvent } from "react";
import { changeDriver, createVehicle, getDebt, getDebtSummaries, updateVehicle } from "./api";
import DriverSection from "./DriverSection";
import { monthLabel, shortDate, todayYMD, tsh } from "./format";
import type { DebtEntry, DebtSummary, Vehicle } from "./types";

// Vehicle types. The owner types the amount per day and the working days per week.
export const PRESETS = [
  { key: "Bajaj", label: "Bajaj", days: 6, daily: 16000, hint: "Hufanya kazi Jumatatu–Jumamosi (siku 6)" },
  { key: "Bodaboda", label: "Bodaboda", days: 7, daily: 10000, hint: "Hufanya kazi siku zote 7 za wiki" },
];

export interface PeriodSel { mode: "month" | "week"; week: number; }

const WEEK_RE = /Week (\d+): Income (\d+) vs Target (\d+)/;
const WEEK_TYPES = ["WEEKLY_DEFICIT", "WEEKLY_EXCESS", "EXCESS_PAYMENT", "NO_CHANGE"];

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

// ---------- Edit vehicle (inline, opened by the pencil) ----------
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
export function VehicleCard(props: {
  vehicle: Vehicle; month: string; tick: number; period: PeriodSel;
  onOpen: () => void; onDelete: () => void; onUpdated: () => void; canManage: boolean;
}) {
  const { vehicle, month, tick, period, onOpen, onDelete, onUpdated, canManage } = props;
  const [s, setS] = useState<DebtSummary | null>(null);
  const [entries, setEntries] = useState<DebtEntry[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let alive = true;
    getDebt(vehicle.id, month)
      .then((d) => { if (alive) { setS(d.summary); setEntries(d.entries); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [vehicle.id, month, tick]);

  const latest = [...vehicle.driver_periods].sort((a, b) => a.from_date.localeCompare(b.from_date)).pop();
  const driverText = latest && latest.driver_name
    ? `Driver: ${latest.driver_name}${latest.phone ? " • " + latest.phone : ""}`
    : "Hakuna dereva";
  const monthTarget = s ? s.weekly_target * 4 : 0;
  const week = period.mode === "week" ? weekRowOf(entries, period.week) : null;

  return (
    <article className="vcard" onClick={onOpen}>
      <div className="vhead">
        <div className="vtitle">
          <h3>{vehicle.name}</h3>
          <span className="badge type">{vehicle.vehicle_type.toUpperCase()}</span>
          <span className="badge month">{monthLabel(month)}</span>
        </div>
        {canManage && (
          <div className="vactions">
            <button className="icon" aria-label="Hariri" title="Hariri" onClick={(e) => { e.stopPropagation(); setEditing((v) => !v); }}>✏️</button>
            <button className="icon" aria-label="Futa" title="Futa" onClick={(e) => { e.stopPropagation(); onDelete(); }}>🗑️</button>
          </div>
        )}
      </div>
      <p className="driver">{driverText}</p>

      {canManage && editing && (
        <EditVehicleInline
          vehicle={vehicle}
          onSaved={() => { setEditing(false); onUpdated(); }}
          onClose={() => setEditing(false)}
          onRefresh={onUpdated}
        />
      )}

      {!s && <p className="driver">Inapakia...</p>}

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
          ) : (
            <p className="driver">Hakuna data ya Week {period.week} mwezi huu</p>
          )}
        </div>
      )}

      {s && period.mode === "month" && (
        <>
          <div className="block">
            <div className="block-title">MONTH</div>
            <div className="row-line"><span>Target:</span><b className="blue">{tsh(monthTarget)}</b></div>
            <div className="row-line"><span>Paid:</span><b className="green">{tsh(s.payments)}</b></div>
          </div>
          <div className="row-line"><span>Month Debt:</span><b className="orange">{tsh(s.debt_added)}</b></div>
          <div className="row-line"><span>Carry Over Debt:</span><b className="orange">{tsh(s.starting_debt)}</b></div>
        </>
      )}
      {s && <div className="total"><span>Total Debt:</span><b>{tsh(s.ending_debt)}</b></div>}
    </article>
  );
}

function addDaysLocal(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// ---------- Unified fleet dashboard ----------
function HalfGauge({ value, max, tone }: { value: number; max: number; tone: "income" | "debt" }) {
  const progress = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <svg className={`fleet-gauge fleet-gauge-${tone}`} viewBox="0 0 300 124" role="img" aria-label={`${progress.toFixed(1)} percent`}>
      <defs>
        <linearGradient id={`gauge-${tone}`} x1="0" y1="0" x2="1" y2="0">
          {tone === "income" ? <><stop offset="0%" stopColor="#06b6d4"/><stop offset="52%" stopColor="#22c55e"/><stop offset="100%" stopColor="#f59e0b"/></> : <><stop offset="0%" stopColor="#f59e0b"/><stop offset="55%" stopColor="#f97316"/><stop offset="100%" stopColor="#ef4444"/></>}
        </linearGradient>
      </defs>
      <path d="M 20 108 A 130 130 0 0 1 280 108" pathLength="100" className="gauge-track" />
      <path d="M 20 108 A 130 130 0 0 1 280 108" pathLength="100" className="gauge-value" stroke={`url(#gauge-${tone})`} strokeDasharray={`${progress} 100`} />
    </svg>
  );
}

function FleetSummaryCard({ vehicles, month, tick }: { vehicles: Vehicle[]; month: string; tick: number }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getDebtSummaries>>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getDebtSummaries(month)
      .then((data) => { if (alive) setRows(data); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month, tick, vehicles.length]);

  const summaryById = new Map(rows.map((r) => [r.vehicle_id, r.summary]));
  const target = vehicles.reduce((sum, v) => sum + ((summaryById.get(v.id)?.weekly_target ?? (v.daily_target * v.working_days_count)) * (v.include_week5 ? 5 : 4)), 0);
  const paid = vehicles.reduce((sum, v) => sum + (summaryById.get(v.id)?.payments ?? 0), 0);
  const monthDebt = vehicles.reduce((sum, v) => sum + (summaryById.get(v.id)?.debt_added ?? 0), 0);
  const carryDebt = vehicles.reduce((sum, v) => sum + (summaryById.get(v.id)?.starting_debt ?? 0), 0);
  const totalDebt = vehicles.reduce((sum, v) => sum + (summaryById.get(v.id)?.ending_debt ?? 0), 0);
  const incomePct = target > 0 ? Math.min(100, (paid / target) * 100) : 0;
  const debtPct = target > 0 ? Math.min(100, (totalDebt / target) * 100) : 0;
  const money = (n: number) => `TSh ${Math.round(n).toLocaleString("en-US")}`;

  return (
    <section className="fleet-summary-card" aria-label="Muhtasari wa biashara">
      <div className="fleet-income-head">
        <div className="fleet-section-icon">↗</div>
        <div className="fleet-section-title"><h2>Mapato ya Mwezi</h2><span>Income Progress</span></div>
        <div className="fleet-percent income-percent">↗ {incomePct.toFixed(1)}%</div>
      </div>
      <div className="fleet-income-gauge">
        <div className="gauge-callout income-callout">{money(paid)}</div>
        <HalfGauge value={paid} max={target} tone="income" />
        <div className="gauge-center"><strong>{money(paid)}</strong><span>/ {money(target)}</span></div>
        <div className="gauge-min">0</div><div className="gauge-max">{money(target)} <small>(100%)</small></div>
      </div>
      <div className="fleet-stat-grid">
        <div className="fleet-stat stat-blue"><span className="stat-icon">▣</span><div><small>Deni la Mwezi</small><strong>{money(monthDebt)}</strong></div></div>
        <div className="fleet-stat stat-green"><span className="stat-icon">↻</span><div><small>Deni la Kubeba</small><strong>{money(carryDebt)}</strong></div></div>
        <div className="fleet-stat stat-purple"><span className="stat-icon">▤</span><div><small>Jumla ya Deni</small><strong>{money(totalDebt)}</strong></div></div>
        <div className="fleet-stat stat-cyan"><span className="stat-icon">🚘</span><div><small>Magari Yaliyopo</small><strong>{vehicles.length}</strong></div></div>
      </div>
      <div className="fleet-debt-section">
        <div className="fleet-debt-heading"><div><span className="debt-alert-icon">!</span><div><h2>Madeni ya Jumla</h2><small>Total Debt</small></div></div><strong>{money(totalDebt)}</strong></div>
        <div className="fleet-debt-gauge">
          <div className="gauge-callout debt-callout">{money(totalDebt)}</div>
          <HalfGauge value={totalDebt} max={target} tone="debt" />
          <div className="gauge-center"><strong>{money(totalDebt)}</strong><span>/ {money(target)}</span></div>
          <div className="gauge-min">0</div><div className="gauge-max">{money(target)} <small>(Target)</small></div>
        </div>
        <div className="fleet-debt-note">{loading ? "Inapakia taarifa za madeni..." : totalDebt > target && target > 0 ? "Deni limezidi target ya mwezi" : `${debtPct.toFixed(1)}% ya target ya mwezi`}</div>
      </div>
      <div className="fleet-summary-footer">🤝 <span>Endelea kuongeza mapato, punguza madeni!</span></div>
    </section>
  );
}

// ---------- List ----------
export default function VehiclesPage(props: {
  vehicles: Vehicle[]; canManage: boolean; month: string; tick: number; period: PeriodSel;
  onOpen: (v: Vehicle) => void; onDelete: (v: Vehicle) => void; onAdded: () => void; onUpdated: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <FleetSummaryCard vehicles={props.vehicles} month={props.month} tick={props.tick} />
      {props.canManage && (adding ? (
        <AddVehicleForm onSaved={() => { setAdding(false); props.onAdded(); }} onCancel={() => setAdding(false)} />
      ) : (
        <button className="btn-add" onClick={() => setAdding(true)}>+ Ongeza Gari</button>
      ))}
      {props.vehicles.length === 0 && !adding && <p className="card">Hakuna gari bado. Bonyeza + Ongeza Gari.</p>}
      {props.vehicles.map((v) => (
        <VehicleCard
          key={v.id}
          vehicle={v}
          month={props.month}
          tick={props.tick}
          period={props.period}
          onOpen={() => props.onOpen(v)}
          onDelete={() => props.onDelete(v)}
          onUpdated={props.onUpdated}
          canManage={props.canManage}
        />
      ))}
    </>
  );
}
