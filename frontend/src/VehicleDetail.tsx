import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  addManualEntry, createInsurance, createPayment, createService,
  deleteRecord, deleteVehicle, getDebt, listInsurances, listLostDays, listPayments,
  listServices, listTyres, saveLostDays, setCarry, updateVehicle,
} from "./api";
import { confirmIncome, deleteIncome, listIncome, type IncomeRow } from "./incomeApi";
import { confirmManualEntry, confirmPayment, listManualEntries, type ManualEntry, type PaymentRow } from "./roleApi";
import IncomeForm from "./IncomeForm";
import WeekTable from "./WeekTable";
import TargetPanel from "./TargetPanel";
import ToolInput from "./ToolInput";
import RetireTyreDialog from "./RetireTyreDialog";
import DebtTable from "./DebtTable";
import { monthLabel, shortDate, todayYMD, tsh } from "./format";
import type { Role } from "./roles";
import type { DebtEntry, DebtResponse, InsuranceRecord, LostDays, ServiceRecord, TyreRecord, Vehicle } from "./types";
import "./vehicle-detail.css";

type Form = "income" | "service" | "servicePack" | "payment" | "debt" | "tyre" | "insurance" | "edit" | "lost";

const PAYMENT_TYPES = [
  { key: "TRA", label: "TRA Taxes" },
  { key: "maegesho", label: "Maegesho (Parking)" },
  { key: "wrong_parking", label: "Wrong Parking Fine" },
  { key: "police", label: "Police Fine" },
  { key: "debt_payment", label: "Malipo ya Deni" },
];

const FORM_TITLE: Record<Form, string> = {
  income: "Ingiza Mapato",
  payment: "Add Payment",
  service: "Add Service",
  servicePack: "Service ya Pamoja",
  tyre: "Tairi mpya / iliyoharibika",
  insurance: "Add Insurance",
  debt: "Add Debt",
  edit: "Set Targets & Edit Vehicle",
  lost: "Siku zilizopotea",
};

// Bottom bar tiles (owner sees all five; manager sees income and payment; driver sees none).
const BAR: { key: Form; label: string; icon: string }[] = [
  { key: "income", label: "Income", icon: "💵" },
  { key: "service", label: "Service", icon: "🔧" },
  { key: "payment", label: "Payment", icon: "🧾" },
  { key: "servicePack", label: "Pamoja", icon: "🧰" },
  { key: "tyre", label: "Tairi", icon: "🛞" },
];
// Opened from the + tile (owner only).
const MORE: { key: Form | "saveMonth" | "delete"; label: string; icon: string; red?: boolean }[] = [
  { key: "debt", label: "Add Debt", icon: "📝" },
  { key: "lost", label: "Siku zilizopotea", icon: "📅" },
  { key: "insurance", label: "Insurance", icon: "🛡️" },
  { key: "edit", label: "Set Targets & Edit", icon: "🎯" },
  { key: "saveMonth", label: "Save Month", icon: "💾" },
  { key: "delete", label: "Delete Vehicle", icon: "🗑️", red: true },
];
const MANAGER_TILES = ["income", "payment"];
const PLACEHOLDER = "Save Month inajengwa katika hatua inayofuata.";

function parseWeekNote(note: string): { week: number } | null {
  const m = note.match(/Week (\d+): Income (\d+) vs Target (\d+)/);
  return m ? { week: Number(m[1]) } : null;
}
function shiftMonth(m: string, d: number): string {
  const dt = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

// A popup dialog. Closes on Escape, on the X button, or on a tap outside the box.
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="vd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vd-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="vd-modal-head">
          <h3>{title}</h3>
          <button className="vd-x" aria-label="Funga" onClick={onClose}>✕</button>
        </div>
        <div className="vd-modal-body">{children}</div>
      </div>
    </div>
  );
}

export default function VehicleDetail(props: {
  vehicle: Vehicle; allVehicles: Vehicle[]; role: Role; month: string;
  onBack: () => void; onChanged: () => void; onDeleted: () => void; onMonthChange: (m: string) => void;
}) {
  const { vehicle, allVehicles, role, month, onBack, onChanged, onDeleted, onMonthChange } = props;
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isDriver = role === "driver";
  const canEditMoney = isOwner || isManager;
  const showOtherRecords = isOwner;

  const barTiles = isOwner ? BAR : isManager ? BAR.filter((t) => MANAGER_TILES.includes(t.key)) : [];
  const cols = barTiles.length + (isOwner ? 1 : 0);

  const [debt, setDebt] = useState<DebtResponse | null>(null);
  const [returns, setReturns] = useState<IncomeRow[]>([]);
  const [lost, setLost] = useState<LostDays[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [manual, setManual] = useState<ManualEntry[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [tyres, setTyres] = useState<TyreRecord[]>([]);
  const [insurances, setInsurances] = useState<InsuranceRecord[]>([]);
  const [more, setMore] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [fDay, setFDay] = useState(todayYMD());
  const [fAmount, setFAmount] = useState("");
  const [fNote, setFNote] = useState("");
  const [editingIncome, setEditingIncome] = useState<IncomeRow | null>(null);
  const [fPayType, setFPayType] = useState("TRA");
  const [fTool, setFTool] = useState("");
  const [fCount, setFCount] = useState("1");
  const [fUnit, setFUnit] = useState("");
  const [fSeller, setFSeller] = useState("");
  const [fTyre, setFTyre] = useState("");
  const [fInsType, setFInsType] = useState("");
  const [fMonths, setFMonths] = useState("12");
  const [fWeek, setFWeek] = useState("1");
  const [fLostDays, setFLostDays] = useState("1");

  const currentYM = todayYMD().slice(0, 7);
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  async function load() {
    try {
      const [d, r, l, p, s, t, i, m] = await Promise.all([
        getDebt(vehicle.id, month), listIncome(vehicle.id), listLostDays(vehicle.id),
        listPayments(vehicle.id), listServices(vehicle.id), listTyres(vehicle.id), listInsurances(vehicle.id),
        listManualEntries(vehicle.id),
      ]);
      setDebt(d);
      setReturns(r.filter((x) => (x.record_month || x.day.slice(0, 7)) === month).sort((a, b) => b.day.localeCompare(a.day)));
      setLost(l.filter((x) => x.month === month));
      setPayments((p as PaymentRow[]).filter((x) => x.day.startsWith(month)));
      setServices(s.filter((x) => x.day.startsWith(month)));
      setTyres(t.filter((x) => x.day.startsWith(month)));
      setInsurances(i.filter((x) => x.day.startsWith(month)));
      setManual(m.filter((x) => x.day.startsWith(month)));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    setForm(null);
    setMore(false);
    setNotice("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id, month]);

  async function run(action: () => Promise<unknown>, ok: string) {
    try {
      setError("");
      await action();
      setNotice(ok);
      setForm(null);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function clearFields() {
    setFAmount(""); setFNote(""); setFTool(""); setFCount("1"); setFUnit("");
    setFSeller(""); setFTyre(""); setFInsType(""); setFMonths("12");
    setFWeek("1"); setFLostDays("1");
  }

  function open(key: Form | "saveMonth" | "delete") {
    setMore(false);
    setNotice("");
    if (key === "saveMonth") { setNotice(PLACEHOLDER); return; }
    if (key === "delete") { removeVehicle(); return; }
    clearFields();
    setEditingIncome(null);
    setFDay(todayYMD());
    setForm(key);
  }
  const closeForm = () => { setForm(null); setEditingIncome(null); };

  const wd = vehicle.working_days_count;
  const daily = vehicle.daily_target;
  const weekly = daily * wd;
  const s = debt?.summary;
  const entries: DebtEntry[] = debt?.entries ?? [];
  const weeksCount = entries.filter((e) => parseWeekNote(e.notes) !== null).length || 4;
  const monthTarget = entries.reduce((a, e) => {
    if (!parseWeekNote(e.notes)) return a;
    const t = e.notes.match(/Target (\d+)/);
    return a + (t ? Number(t[1]) : 0);
  }, 0);
  const totalIncome = returns.filter((r) => !r.is_excess).reduce((a, r) => a + r.amount, 0);
  const daysLost = lost.reduce((a, l) => a + l.days, 0);
  const lossAmount = daysLost * daily;

  function submitDebt(e: FormEvent) {
    e.preventDefault();
    run(() => addManualEntry(vehicle.id, "MANUAL_DEBT", fDay, Number(fAmount), fNote.trim()), "Deni limeongezwa.");
  }
  function submitPayment(e: FormEvent) {
    e.preventDefault();
    run(() => createPayment(vehicle.id, fDay, fPayType, Number(fAmount), fNote.trim()), "Malipo yamehifadhiwa.");
  }
  function submitService(e: FormEvent, pack: boolean) {
    e.preventDefault();
    run(() => createService(vehicle.id, {
      day: fDay, tool: fTool.trim(), count: Number(fCount) || 1,
      unit_price: Number(fUnit) || 0, seller: fSeller.trim(), note: fNote.trim(),
    }), pack ? "Service ya pamoja imehifadhiwa." : "Service imehifadhiwa.");
  }
  function submitInsurance(e: FormEvent) {
    e.preventDefault();
    run(() => createInsurance(vehicle.id, fDay, fInsType.trim(), Number(fAmount) || 0, Number(fMonths) || 12, fNote.trim()), "Bima imehifadhiwa.");
  }
  // Siku zilizopotea: updates the week's row if it already exists, otherwise creates it.
  function submitLost(e: FormEvent) {
    e.preventDefault();
    const week = Number(fWeek);
    const existing = lost.find((l) => l.week_number === week);
    run(
      () => saveLostDays(vehicle.id, month, week, Number(fLostDays), existing?.id),
      "Siku zimehifadhiwa.",
    );
  }
  async function removeVehicle() {
    if (!confirm(`Futa gari ${vehicle.name}? Historia yake yote itafutwa.`)) return;
    try { await deleteVehicle(vehicle.id); onDeleted(); }
    catch (e) { setError((e as Error).message); }
  }
  function removeRecord(path: "payment-records" | "service-records" | "tyre-records" | "insurance-records", id: number) {
    if (!confirm("Futa rekodi hii?")) return;
    run(() => deleteRecord(path, id), "Rekodi imefutwa.");
  }
  function signIncome(id: number) { run(() => confirmIncome(id), "Mapato yamethibitishwa."); }
  function signPayment(id: number) { run(() => confirmPayment(id), "Malipo yamethibitishwa."); }
  function signManual(id: number) { run(() => confirmManualEntry(id), "Deni limethibitishwa."); }

  const paymentLabel = (k: string) => PAYMENT_TYPES.find((p) => p.key === k)?.label ?? k;
  const manualLabel = (k: string) => (k === "MANUAL_PAYMENT" ? "Malipo ya deni" : k === "CARRY_OVER" ? "Deni lililobaki" : "Deni");

  return (
    <div className="detail vd-root">
      <div className="detail-top">
        <button className="back" onClick={onBack}>← Rudi Nyuma</button>
      </div>

      <div className="vd-mnav-row">
        <button className="vd-mnav" onClick={() => onMonthChange(prevMonth)} aria-label={`Mwezi uliopita: ${monthLabel(prevMonth)}`}>
          ‹ <span>{monthLabel(prevMonth)}</span>
        </button>
        <div className="vd-mnav-cur">{monthLabel(month)}</div>
        <button className="vd-mnav" disabled={month >= currentYM}
          onClick={() => onMonthChange(nextMonth)} aria-label={`Mwezi unaofuata: ${monthLabel(nextMonth)}`}>
          <span>{monthLabel(nextMonth)}</span> ›
        </button>
      </div>

      <section className="card title-card">
        <h3>{vehicle.name} <span className="badge type">{vehicle.vehicle_type.toUpperCase()}</span></h3>
        <p className="driver">{monthLabel(month)}</p>
      </section>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {isOwner && (
        <section className="card week5">
          <label className="toggle">
            <span>Week 5:</span>
            <input type="checkbox" checked={vehicle.include_week5}
              onChange={(e) => run(() => updateVehicle(vehicle.id, { include_week5: e.target.checked }), "Week 5 imebadilishwa.")} />
            <b>{vehicle.include_week5 ? "ON (5 weeks)" : "OFF (4 weeks)"}</b>
          </label>
        </section>
      )}

      <section className="card summary-block">
        <h4 className="sum-title">Mwezi wa {monthLabel(month)}</h4>
        <div className="kv-grid">
          <div><span>WEEKLY TARGET</span><b className="blue">{tsh(weekly)}</b></div>
          <div><span>WORKING DAYS/WEEK</span><b className="purple">{wd}/{wd}</b></div>
          <div><span>MONTHLY TARGET</span><b className="blue">{tsh(monthTarget)}</b></div>
          <div><span>TOTAL INCOME</span><b className="green">{tsh(totalIncome)}</b></div>
          <div><span>DAYS LOST</span><b className="red">{daysLost}</b></div>
          <div><span>LOSS AMOUNT</span><b className="red">{tsh(lossAmount)}</b></div>
        </div>
      </section>

      <section className="card">
        <h3>Dashibodi ya Deni</h3>
        {s ? (
          <>
            <div className="grid">
              <div className="card"><h4>Starting Debt</h4><b className="orange">{tsh(s.starting_debt)}</b></div>
              <div className="card"><h4>Debt Addition</h4><b className="red">{tsh(s.debt_added)}</b></div>
              <div className="card"><h4>Debt Payment</h4><b className="green">{tsh(s.payments)}</b></div>
              <div className="card"><h4>Weekly Target</h4><b className="blue">{tsh(s.weekly_target)}</b></div>
              <div className="card"><h4>Weeks in Month</h4><b className="purple">{weeksCount}</b></div>
              <div className="card"><h4>Ending Debt</h4><b className="red">{tsh(s.ending_debt)}</b></div>
            </div>
            <label className="toggle carry">
              <input type="checkbox" checked={s.carry_over_on} disabled={!isOwner}
                onChange={(e) => run(() => setCarry(vehicle.id, month, e.target.checked), "Carry over imebadilishwa.")} />
              <span>Deni la mwezi huu lipelekwe mwezi unaofuata (Carry over)</span>
            </label>
          </>
        ) : <p className="empty">Inapakia...</p>}
      </section>

      <section className="card">
        <h3>Historia ya Deni</h3>
        <DebtTable entries={entries} />
      </section>

      {isDriver && (
        <section className="card">
          <h3>Thibitisha Deni Lako</h3>
          <ul className="list">
            {manual.length === 0 && <li className="empty">Hakuna deni la mkono mwezi huu</li>}
            {manual.map((m) => (
              <li key={m.id}>
                <span>{shortDate(m.day)} · {manualLabel(m.kind)}{m.note ? ` · ${m.note}` : ""}
                  {m.confirmed_at ? " · Confirmed" : " · Pending"}</span>
                <b className="orange">{tsh(m.amount)}</b>
                {!m.confirmed_at && <button className="confirm-btn" onClick={() => signManual(m.id)}>Thibitisha</button>}
              </li>
            ))}
          </ul>
        </section>
      )}


      <section className="card">
        <h3>Muhtasari wa Wiki za Mwezi</h3>
        <WeekTable entries={entries} returns={returns} month={month} workingDays={wd}
          lostDays={lost.map((l) => ({ week_number: l.week_number, days: l.days }))} />
      </section>

      <section className="card">
        <h3>Historia ya Mapato</h3>
        <ul className="list">
          {returns.length === 0 && <li className="empty">No income records for this month</li>}
          {returns.map((r) => (
            <li key={r.id}>
              <span>
                {shortDate(r.day)} · {r.is_excess ? "Malipo ya Ziada" : "Income"}
                {r.week_number ? ` · Wiki ${r.week_number}` : ""}
                {r.period_start && r.period_end ? ` (${shortDate(r.period_start)} - ${shortDate(r.period_end)})` : ""}
                {r.note ? ` · ${r.note}` : ""}
                {r.confirmed_at ? " · Confirmed" : " · Pending"}
              </span>
              <b className="green">{r.is_excess ? "-" : "+"}{tsh(r.amount)}</b>
              {canEditMoney && (
                <button className="edit-btn" onClick={() => { setEditingIncome(r); setForm("income"); setNotice(""); }}>Edit</button>
              )}
              {canEditMoney && (
                <button className="danger" onClick={() => { if (confirm("Futa mapato haya?")) run(() => deleteIncome(r.id), "Mapato yamefutwa."); }}>Del</button>
              )}
              {isDriver && !r.confirmed_at && (
                <button className="confirm-btn" onClick={() => signIncome(r.id)}>Thibitisha</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Historia ya Malipo</h3>
        <ul className="list">
          {payments.length === 0 && <li className="empty">No payment records for this month</li>}
          {payments.map((p) => (
            <li key={p.id}>
              <span>{p.day} · {paymentLabel(p.payment_type)}{p.note ? ` · ${p.note}` : ""}
                {p.confirmed_at ? " · Confirmed" : " · Pending"}</span>
              <b className="green">{tsh(p.amount)}</b>
              {canEditMoney && <button className="danger" onClick={() => removeRecord("payment-records", p.id)}>Futa</button>}
              {isDriver && !p.confirmed_at && <button className="confirm-btn" onClick={() => signPayment(p.id)}>Thibitisha</button>}
            </li>
          ))}
        </ul>
      </section>

      {showOtherRecords && (
        <>
          <section className="card">
            <h3>Historia ya Service</h3>
            <ul className="list">
              {services.length === 0 && <li className="empty">No service records for this month</li>}
              {services.map((x) => (
                <li key={x.id}>
                  <span>{x.day} · {x.tool} × {x.count}{x.seller ? ` · ${x.seller}` : ""}</span>
                  <b className="blue">{tsh(x.total)}</b>
                  <button className="danger" onClick={() => removeRecord("service-records", x.id)}>Futa</button>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h3>Historia ya Tairi</h3>
            <ul className="list">
              {tyres.length === 0 && <li className="empty">No tyre records for this month</li>}
              {tyres.map((x) => (
                <li key={x.id}>
                  <span>{x.day} · {x.tyre_number || "Tairi"}</span>
                  <b className="blue">{tsh(x.amount)}</b>
                  <button className="danger" onClick={() => removeRecord("tyre-records", x.id)}>Futa</button>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h3>Historia ya Bima</h3>
            <ul className="list">
              {insurances.length === 0 && <li className="empty">No insurance records for this month</li>}
              {insurances.map((x) => (
                <li key={x.id}>
                  <span>{x.day} · {x.insurance_type || "Bima"} · miezi {x.months}</span>
                  <b className="blue">{tsh(x.amount)}</b>
                  <button className="danger" onClick={() => removeRecord("insurance-records", x.id)}>Futa</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Fixed bottom action bar (owner and manager only). */}
      {cols > 0 && (
        <nav className="vd-nav" aria-label="Vitendo vya gari" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {barTiles.map((t) => (
            <button key={t.key} className="vd-tile" onClick={() => open(t.key)} aria-label={FORM_TITLE[t.key]}>
              <span className="vd-ico">{t.icon}</span>
              <span className="vd-lbl">{t.label}</span>
            </button>
          ))}
          {isOwner && (
            <button className="vd-tile vd-plus" onClick={() => setMore(true)} aria-label="Vitendo zaidi">
              <span className="vd-ico">＋</span>
              <span className="vd-lbl">Zaidi</span>
            </button>
          )}
        </nav>
      )}

      {/* "+" sheet with the rest of the actions. */}
      {more && isOwner && (
        <>
          <div className="vd-overlay" style={{ background: "rgba(15,23,42,.4)" }} onMouseDown={() => setMore(false)} />
          <div className="vd-sheet" role="menu">
            <div className="vd-sheet-handle" />
            <div className="vd-sheet-title">{vehicle.name} · Vitendo zaidi</div>
            <div className="vd-sheet-grid">
              {MORE.map((a) => (
                <button key={a.label} className={"vd-sheet-item" + (a.red ? " red" : "")} onClick={() => open(a.key)}>
                  <span className="vd-ico">{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Forms open as popup dialogs. */}
      {form && (
        <Dialog title={FORM_TITLE[form]} onClose={closeForm}>
          {form === "income" && (
            <IncomeForm
              key={editingIncome?.id ?? "new"}
              vehicleId={vehicle.id}
              workingDays={wd}
              includeWeek5={vehicle.include_week5}
              defaultMonth={month}
              editing={editingIncome}
              onSaved={() => { closeForm(); setNotice("Mapato yamehifadhiwa."); load(); onChanged(); }}
              onCancel={closeForm}
            />
          )}
          {form === "payment" && (
            <form onSubmit={submitPayment}>
              <h3>Add Payment</h3>
              <label>Aina ya Malipo
                <select value={fPayType} onChange={(e) => setFPayType(e.target.value)}>
                  {PAYMENT_TYPES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </label>
              <label>Tarehe ya Malipo<input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required /></label>
              <label>Kiasi (TSh)<input type="number" inputMode="numeric" value={fAmount} onChange={(e) => setFAmount(e.target.value)} required min={1} /></label>
              <label>Maelezo<input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
              {fPayType !== "debt_payment" && <p className="hint">Aina hii ni gharama tu. Haipunguzi deni.</p>}
              <div className="vd-actions">
                <button type="submit">Hifadhi</button>
                <button type="button" className="ghost" onClick={closeForm}>Sitisha / Cancel</button>
              </div>
            </form>
          )}
          {form === "debt" && (
            <form onSubmit={submitDebt}>
              <h3>Add Debt</h3>
              <label>Tarehe ya Record<input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required /></label>
              <label>Kiasi (TSh)<input type="number" inputMode="numeric" value={fAmount} onChange={(e) => setFAmount(e.target.value)} required min={1} /></label>
              <label>Maelezo<input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
              <div className="vd-actions">
                <button type="submit">Hifadhi</button>
                <button type="button" className="ghost" onClick={closeForm}>Sitisha / Cancel</button>
              </div>
            </form>
          )}
          {(form === "service" || form === "servicePack") && (
            <form onSubmit={(e) => submitService(e, form === "servicePack")}>
              <h3>{form === "servicePack" ? "Ongeza Service ya Pamoja" : "Add Service"}</h3>
              <label>Tarehe ya Malipo<input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required /></label>
              <ToolInput vehicleIds={allVehicles.map((v) => v.id)} value={fTool} onChange={setFTool} day={fDay} required />
              <label>Idadi<input type="number" inputMode="numeric" value={fCount} onChange={(e) => setFCount(e.target.value)} min={1} required /></label>
              <label>Bei ya Kimoja (TSh)<input type="number" inputMode="numeric" value={fUnit} onChange={(e) => setFUnit(e.target.value)} min={0} /></label>
              <label>Muuzaji<input value={fSeller} onChange={(e) => setFSeller(e.target.value)} placeholder="Jina la muuzaji" /></label>
              <label>Maelezo<input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
              <p className="hint">Jumla: {tsh((Number(fCount) || 0) * (Number(fUnit) || 0))}</p>
              <div className="vd-actions">
                <button type="submit">{form === "servicePack" ? "Hifadhi kwa Vyombo Vyote" : "Hifadhi"}</button>
                <button type="button" className="ghost" onClick={closeForm}>Sitisha / Cancel</button>
              </div>
            </form>
          )}
          {form === "tyre" && (
            <RetireTyreDialog
              vehicle={vehicle}
              allVehicles={allVehicles}
              defaultDay={fDay}
              onDone={(msg) => { closeForm(); setNotice(msg); load(); onChanged(); }}
            />
          )}
          {form === "insurance" && (
            <form onSubmit={submitInsurance}>
              <h3>Add Insurance</h3>
              <label>Tarehe ya Malipo<input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required /></label>
              <label>Kiasi (TSh)<input type="number" inputMode="numeric" value={fAmount} onChange={(e) => setFAmount(e.target.value)} min={0} /></label>
              <label>Aina ya Bima<input value={fInsType} onChange={(e) => setFInsType(e.target.value)} placeholder="Comprehensive, Third Party" /></label>
              <label>Muda (Miezi)<input type="number" inputMode="numeric" value={fMonths} onChange={(e) => setFMonths(e.target.value)} min={1} /></label>
              <label>Maelezo<input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
              <div className="vd-actions">
                <button type="submit">Hifadhi</button>
                <button type="button" className="ghost" onClick={closeForm}>Sitisha / Cancel</button>
              </div>
            </form>
          )}
          {form === "lost" && (
            <form onSubmit={submitLost}>
              <h3>Siku zilizopotea</h3>
              <label>Wiki
                <select value={fWeek} onChange={(e) => setFWeek(e.target.value)}>
                  {(vehicle.include_week5 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]).map((w) => (
                    <option key={w} value={w}>Wiki {w}</option>
                  ))}
                </select>
              </label>
              <label>Siku zilizopotea (1-7)
                <input type="number" inputMode="numeric" min={1} max={7} value={fLostDays}
                  onChange={(e) => setFLostDays(e.target.value)} required />
              </label>
              <p className="hint">Mwezi: {monthLabel(month)}. Ikiwa wiki hiyo ina rekodi, itabadilishwa.</p>
              <div className="vd-actions">
                <button type="submit">Hifadhi</button>
                <button type="button" className="ghost" onClick={closeForm}>Sitisha / Cancel</button>
              </div>
            </form>
          )}
          {form === "edit" && (
            <TargetPanel vehicle={vehicle} month={month} onSaved={() => { load(); onChanged(); }} />
          )}
          {form === "edit" && <button className="ghost" onClick={closeForm}>Sitisha / Cancel</button>}
        </Dialog>
      )}
    </div>
  );
}
