import { useEffect, useState, type FormEvent } from "react";
import { changeDriver, createVehicle, getDebt, getDebtSummaries, updateVehicle } from "./api";
import DriverSection from "./DriverSection";
import { monthLabel, shortDate, todayYMD, tsh } from "./format";
import type { DebtEntry, DebtSummary, Vehicle } from "./types";


const FLEET_DASHBOARD_CSS = `
.fleet-summary-card{position:relative;overflow:hidden;margin:14px 0 18px;padding:18px 16px 14px;border:1px solid #cfe0ff;border-radius:30px;background:linear-gradient(155deg,#fff 0%,#f7fbff 54%,#fff 100%);box-shadow:0 14px 35px rgba(30,64,175,.13);color:#102b66}
.fleet-income-head{display:flex;align-items:center;gap:12px;min-width:0}
.fleet-section-icon{width:52px;height:52px;flex:0 0 52px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(145deg,#38bdf8,#075de8);color:#fff;font-size:34px;font-weight:900;box-shadow:0 7px 16px #0b64dc44}
.fleet-section-title{min-width:0;flex:1}.fleet-section-title h2,.fleet-debt-heading h2{margin:0;color:#102b66;font-size:19px;line-height:1.2;font-weight:900}.fleet-section-title span,.fleet-debt-heading small{font-size:12px;color:#536b98;font-weight:650}
.fleet-percent{white-space:nowrap;border-radius:30px;padding:9px 12px;font-size:16px;font-weight:900}.income-percent{background:#d7f9e9;color:#07834e}
.fleet-income-gauge,.fleet-debt-gauge{position:relative;height:190px;margin:2px 0 10px}
.fleet-gauge{position:absolute;left:2%;top:4px;width:96%;height:145px;overflow:visible}
.gauge-track,.gauge-value{fill:none;stroke-width:17;stroke-linecap:round}.gauge-track{stroke:#dce5f4}.gauge-value{transition:stroke-dasharray .8s ease}
.gauge-center{position:absolute;left:0;right:0;top:91px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:0;pointer-events:none}.gauge-center strong{font-size:clamp(23px,6vw,34px);line-height:1.15;color:#102b66;font-weight:950;letter-spacing:-.8px}.gauge-center span{font-size:18px;font-weight:750;color:#526b99}
.gauge-callout{position:absolute;z-index:2;top:19px;left:12%;padding:7px 13px;border-radius:20px;color:#fff;font-size:13px;font-weight:900;box-shadow:0 5px 12px #0f172a22}.income-callout{background:linear-gradient(120deg,#059669,#16a34a)}
.gauge-min,.gauge-max{position:absolute;top:145px;font-size:12px;font-weight:900;color:#102b66}.gauge-min{left:5%}.gauge-max{right:4%;text-align:right}.gauge-max small{display:block;font-size:10px;color:#7183a5}
.fleet-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:4px 0 14px}
.fleet-stat{min-width:0;display:flex;align-items:center;gap:10px;padding:12px 10px;border:1px solid transparent;border-radius:20px;min-height:82px}
.fleet-stat>div{min-width:0;display:flex;flex-direction:column;gap:3px}.fleet-stat small{font-size:12px;font-weight:750;color:#29416f}.fleet-stat strong{font-size:clamp(14px,3.8vw,19px);line-height:1.15;font-weight:950;overflow-wrap:anywhere}
.stat-icon{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border-radius:50%;background:#fff;font-size:23px;font-weight:900;box-shadow:0 4px 12px #1e3a8a18}
.stat-blue{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#bfdbfe}.stat-blue strong{color:#1556c0}.stat-blue .stat-icon{color:#1671e8}
.stat-green{background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-color:#a7f3d0}.stat-green strong{color:#087443}.stat-green .stat-icon{color:#059669}
.stat-purple{background:linear-gradient(135deg,#faf5ff,#ede9fe);border-color:#ddd6fe}.stat-purple strong{color:#7e22ce}.stat-purple .stat-icon{color:#9333ea}
.stat-cyan{background:linear-gradient(135deg,#eff6ff,#e0f2fe);border-color:#bfdbfe}.stat-cyan strong{color:#075985}.stat-cyan .stat-icon{color:#0284c7}
.fleet-debt-section{border-top:1px solid #e3eaf6;padding-top:13px;margin-top:2px;background:linear-gradient(180deg,#fff8f8 0%,#fff 100%);border-radius:18px}
.fleet-debt-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.fleet-debt-heading>div{display:flex;align-items:center;gap:10px}.fleet-debt-heading h2{color:#c51f2d}.debt-alert-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#fb7185,#dc2626);color:#fff;font-size:24px;font-weight:950}.fleet-debt-heading>strong{background:#ffe4e8;color:#c51f2d;padding:8px 11px;border-radius:20px;font-size:14px;white-space:nowrap}
.fleet-debt-gauge{height:174px;margin-bottom:4px}.fleet-debt-gauge .fleet-gauge{height:137px}.fleet-debt-gauge .gauge-center{top:82px}.fleet-debt-gauge .gauge-center strong{font-size:clamp(22px,5.8vw,31px)}.fleet-debt-gauge .gauge-center span{font-size:16px}.fleet-debt-gauge .gauge-min,.fleet-debt-gauge .gauge-max{top:132px}.debt-callout{background:linear-gradient(120deg,#f97316,#dc2626);left:38%;top:8px}
.fleet-debt-note{margin:0 auto 12px;width:max-content;max-width:100%;padding:7px 13px;border-radius:20px;background:#fff1f2;color:#be123c;font-size:12px;font-weight:850;text-align:center}
.fleet-summary-footer{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:9px;padding:13px 8px;border:1px solid #bfdbfe;border-radius:18px;background:linear-gradient(100deg,#eff6ff,#dbeafe);color:#1746a2;font-size:13px;font-weight:850;text-align:center}
@media(min-width:600px){.fleet-summary-card{padding:22px 24px}.fleet-stat{padding:15px}.fleet-stat-grid{gap:12px}.fleet-income-gauge{height:210px}.fleet-gauge{height:165px}.gauge-center{top:108px}.gauge-min,.gauge-max{top:160px}.fleet-debt-gauge{height:190px}.fleet-debt-gauge .gauge-center{top:100px}.fleet-debt-gauge .gauge-min,.fleet-debt-gauge .gauge-max{top:150px}}
@media(max-width:380px){.fleet-summary-card{padding:14px 10px}.fleet-section-title h2{font-size:16px}.fleet-percent{font-size:13px;padding:7px 9px}.fleet-stat{gap:7px;padding:9px 7px}.fleet-stat small{font-size:11px}.stat-icon{width:34px;height:34px;flex-basis:34px;font-size:19px}.fleet-debt-heading>strong{font-size:12px;padding:7px 8px}}
`;

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
  onMonthChange?: (month: string) => void;
  onOpen: (v: Vehicle) => void; onDelete: (v: Vehicle) => void; onAdded: () => void; onUpdated: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <style>{FLEET_DASHBOARD_CSS}</style>
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
