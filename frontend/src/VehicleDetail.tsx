import { useEffect, useState, type FormEvent } from "react";
import {
  addManualEntry, createInsurance, createPayment, createReturn, createService, createTyre,
  deleteRecord, deleteReturn, deleteVehicle, getDebt, listInsurances, listLostDays, listPayments,
  listReturns, listServices, listTyres, setCarry, updateVehicle,
} from "./api";
import { addDays, monthLabel, shortDate, todayYMD, tsh } from "./format";
import { PRESETS } from "./VehiclesPage";
import type {
  DebtEntry, DebtResponse, InsuranceRecord, LostDays, PaymentRecord, ReturnRecord,
  ServiceRecord, TyreRecord, Vehicle,
} from "./types";

type Form = null | "income" | "service" | "servicePack" | "payment" | "debt" | "tyre" | "insurance" | "edit";

const PAYMENT_TYPES = [
  { key: "TRA", label: "TRA Taxes" },
  { key: "maegesho", label: "Maegesho (Parking)" },
  { key: "wrong_parking", label: "Wrong Parking Fine" },
  { key: "police", label: "Police Fine" },
  { key: "debt_payment", label: "Malipo ya Deni" },
];

// The action list shown when the ⋮ button is tapped (same actions as the old app's buttons).
const ACTIONS: { key: Form | "saveMonth" | "delete"; label: string; icon: string; tone: string }[] = [
  { key: "income", label: "Income", icon: "💵", tone: "g-green" },
  { key: "service", label: "Service", icon: "🔧", tone: "g-blue" },
  { key: "payment", label: "Payment", icon: "🧾", tone: "g-purple" },
  { key: "debt", label: "Add Debt", icon: "📝", tone: "g-orange" },
  { key: "tyre", label: "Tyre", icon: "🛞", tone: "g-pink" },
  { key: "insurance", label: "Insurance", icon: "🛡️", tone: "g-teal" },
  { key: "servicePack", label: "Service ya Pamoja", icon: "🧰", tone: "g-indigo" },
  { key: "edit", label: "Set Targets & Days", icon: "🎯", tone: "g-yellow" },
  { key: "saveMonth", label: "Save Month", icon: "💾", tone: "g-emerald" },
  { key: "edit", label: "Edit Vehicle", icon: "✏️", tone: "g-yellow" },
  { key: "delete", label: "Delete Vehicle", icon: "🗑️", tone: "g-red" },
];

interface WeekRow { week: number; start: string; end: string; target: number; income: number; remaining: number; }

function parseWeekNote(note: string): { week: number; income: number; target: number } | null {
  const m = note.match(/Week (\d+): Income (\d+) vs Target (\d+)/);
  return m ? { week: Number(m[1]), income: Number(m[2]), target: Number(m[3]) } : null;
}

const PLACEHOLDER = "Save Month inajengwa katika hatua inayofuata.";

export default function VehicleDetail(props: {
  vehicle: Vehicle; month: string;
  onBack: () => void; onChanged: () => void; onDeleted: () => void;
}) {
  const { vehicle, month, onBack, onChanged, onDeleted } = props;
  const [debt, setDebt] = useState<DebtResponse | null>(null);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [lost, setLost] = useState<LostDays[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [tyres, setTyres] = useState<TyreRecord[]>([]);
  const [insurances, setInsurances] = useState<InsuranceRecord[]>([]);
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState<Form>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // shared form fields
  const [fDay, setFDay] = useState(todayYMD());
  const [fAmount, setFAmount] = useState("");
  const [fNote, setFNote] = useState("");
  const [fExcess, setFExcess] = useState(false);
  const [fPayType, setFPayType] = useState("TRA");
  const [fTool, setFTool] = useState("");
  const [fCount, setFCount] = useState("1");
  const [fUnit, setFUnit] = useState("");
  const [fSeller, setFSeller] = useState("");
  const [fTyre, setFTyre] = useState("");
  const [fInsType, setFInsType] = useState("");
  const [fMonths, setFMonths] = useState("12");
  // edit vehicle / set targets
  const [eName, setEName] = useState(vehicle.name);
  const [eType, setEType] = useState(vehicle.vehicle_type);
  const [eDaily, setEDaily] = useState(String(vehicle.daily_target));
  const [eDays, setEDays] = useState(String(vehicle.working_days_count));

  async function load() {
    try {
      const [d, r, l, p, s, t, i] = await Promise.all([
        getDebt(vehicle.id, month), listReturns(vehicle.id), listLostDays(vehicle.id),
        listPayments(vehicle.id), listServices(vehicle.id), listTyres(vehicle.id), listInsurances(vehicle.id),
      ]);
      setDebt(d);
      setReturns(r.filter((x) => x.day.startsWith(month)).sort((a, b) => b.day.localeCompare(a.day)));
      setLost(l.filter((x) => x.month === month));
      setPayments(p.filter((x) => x.day.startsWith(month)));
      setServices(s.filter((x) => x.day.startsWith(month)));
      setTyres(t.filter((x) => x.day.startsWith(month)));
      setInsurances(i.filter((x) => x.day.startsWith(month)));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    setEName(vehicle.name);
    setEType(vehicle.vehicle_type);
    setEDaily(String(vehicle.daily_target));
    setEDays(String(vehicle.working_days_count));
    setForm(null);
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
    setFAmount(""); setFNote(""); setFExcess(false);
    setFTool(""); setFCount("1"); setFUnit(""); setFSeller("");
    setFTyre(""); setFInsType(""); setFMonths("12");
  }

  function pick(key: Form | "saveMonth" | "delete") {
    setSheet(false);
    setNotice("");
    if (key === "saveMonth") { setNotice(PLACEHOLDER); return; }
    if (key === "delete") { removeVehicle(); return; }
    clearFields();
    setFDay(todayYMD());
    setForm(key);
  }

  const wd = vehicle.working_days_count;
  const daily = vehicle.daily_target;
  const weekly = daily * wd;
  const s = debt?.summary;
  const entries: DebtEntry[] = debt?.entries ?? [];

  const weekRows: WeekRow[] = entries
    .filter((e) => e.type.startsWith("WEEKLY_") || e.type === "NO_CHANGE" || e.type === "EXCESS_PAYMENT")
    .map((e) => {
      const p = parseWeekNote(e.notes);
      return p ? { week: p.week, start: e.date, end: addDays(e.date, wd - 1), target: p.target, income: p.income, remaining: e.remaining_debt } : null;
    })
    .filter((x): x is WeekRow => x !== null);

  const weeksCount = weekRows.length || 4;
  const monthTarget = weekly * weeksCount;
  const totalIncome = returns.filter((r) => !r.is_excess).reduce((a, r) => a + r.amount, 0);
  const daysLost = lost.reduce((a, l) => a + l.days, 0);
  const lossAmount = daysLost * daily;

  // ----- submit handlers -----
  function submitIncome(e: FormEvent) {
    e.preventDefault();
    run(() => createReturn(vehicle.id, fDay, Number(fAmount), fExcess), "Mapato yamehifadhiwa.");
  }
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
  function submitTyre(e: FormEvent) {
    e.preventDefault();
    run(() => createTyre(vehicle.id, fDay, fTyre.trim(), Number(fAmount) || 0, fNote.trim()), "Tairi imehifadhiwa.");
  }
  function submitInsurance(e: FormEvent) {
    e.preventDefault();
    run(() => createInsurance(vehicle.id, fDay, fInsType.trim(), Number(fAmount) || 0, Number(fMonths) || 12, fNote.trim()), "Bima imehifadhiwa.");
  }
  function submitEdit(e: FormEvent) {
    e.preventDefault();
    const preset = PRESETS.find((p) => p.key === eType);
    run(() => updateVehicle(vehicle.id, {
      name: eName.trim().toUpperCase(), vehicle_type: eType,
      daily_target: Number(eDaily), working_days_count: Number(eDays) || preset?.days || wd,
    }), "Gari limebadilishwa.");
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

  const paymentLabel = (k: string) => PAYMENT_TYPES.find((p) => p.key === k)?.label ?? k;

  return (
    <div className="detail">
      <div className="detail-top">
        <button className="back" onClick={onBack}>← Rudi Nyuma</button>
        <button className="dots" aria-label="Vitendo" onClick={() => setSheet(true)}>⋮</button>
      </div>

      {sheet && (
        <>
          <div className="backdrop" onClick={() => setSheet(false)} />
          <div className="sheet" role="menu">
            <div className="sheet-handle" />
            <div className="sheet-title">{vehicle.name} · Vitendo</div>
            {ACTIONS.map((a) => (
              <button key={a.label} className="sheet-item" onClick={() => pick(a.key)}>
                <span className={"sheet-ico " + a.tone}>{a.icon}</span>
                <span>{a.label}</span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      <section className="card title-card">
        <h3>{vehicle.name} <span className="badge type">{vehicle.vehicle_type.toUpperCase()}</span></h3>
        <p className="driver">{monthLabel(month)}</p>
      </section>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <section className="card week5">
        <label className="toggle">
          <span>Week 5:</span>
          <input type="checkbox" checked={vehicle.include_week5}
            onChange={(e) => run(() => updateVehicle(vehicle.id, { include_week5: e.target.checked }), "Week 5 imebadilishwa.")} />
          <b>{vehicle.include_week5 ? "ON (5 weeks)" : "OFF (4 weeks)"}</b>
        </label>
      </section>

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

      {form && (
        <section className="card form-card">
          {form === "income" && (
            <form onSubmit={submitIncome}>
              <h3>Ongeza Mapato</h3>
              <label>Tarehe ya Malipo<input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required /></label>
              <label>Kiasi (TSh)<input type="number" inputMode="numeric" value={fAmount} onChange={(e) => setFAmount(e.target.value)} required min={1} /></label>
              <label className="inline"><input type="checkbox" checked={fExcess} onChange={(e) => setFExcess(e.target.checked)} /> Hii ni Malipo ya Ziada (Excess) - Itapunguza Deni</label>
              <label>Maelezo<input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
              <button type="submit">Hifadhi</button>
            </form>
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
              <button type="submit">Hifadhi</button>
            </form>
          )}
          {form === "debt" && (
            <form onSubmit={submitDebt}>
              <h3>Add Debt</h3>
              <label>Tarehe ya Record<input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required /></label>
              <label>Kiasi (TSh)<input type="number" inputMode="numeric" value={fAmount} onChange={(e) => setFAmount(e.target.value)} required min={1} /></label>
              <label>Maelezo<input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
              <button type="submit">Hifadhi</button>
            </form>
          )}
          {(form === "service" || form === "servicePack") && (
            <form onSubmit={(e) => submitService(e, form === "servicePack")}>
              <h3>{form === "servicePack" ? "Ongeza Service ya Pamoja" : "Add Service"}</h3>
              <label>Tarehe ya Malipo<input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required /></label>
              <label>Kifaa (Tool)<input value={fTool} onChange={(e) => setFTool(e.target.value)} placeholder="Mafuta, Filter, nk" required /></label>
              <label>Idadi<input type="number" inputMode="numeric" value={fCount} onChange={(e) => setFCount(e.target.value)} min={1} required /></label>
              <label>Bei ya Kimoja (TSh)<input type="number" inputMode="numeric" value={fUnit} onChange={(e) => setFUnit(e.target.value)} min={0} /></label>
              <label>Muuzaji<input value={fSeller} onChange={(e) => setFSeller(e.target.value)} placeholder="Jina la muuzaji" /></label>
              <label>Maelezo<input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
              <p className="hint">Jumla: {tsh((Number(fCount) || 0) * (Number(fUnit) || 0))}</p>
              <button type="submit">{form === "servicePack" ? "Hifadhi kwa Vyombo Vyote" : "Hifadhi"}</button>
            </form>
          )}
          {form === "tyre" && (
            <form onSubmit={submitTyre}>
              <h3>Add Tyre</h3>
              <label>Tarehe ya Malipo<input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required /></label>
              <label>Namba ya Tairi<input value={fTyre} onChange={(e) => setFTyre(e.target.value)} placeholder="TYRE001" /></label>
              <label>Kiasi (TSh)<input type="number" inputMode="numeric" value={fAmount} onChange={(e) => setFAmount(e.target.value)} min={0} /></label>
              <label>Maelezo<input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
              <button type="submit">Hifadhi</button>
            </form>
          )}
          {form === "insurance" && (
            <form onSubmit={submitInsurance}>
              <h3>Add Insurance</h3>
              <label>Tarehe ya Malipo<input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required /></label>
              <label>Kiasi (TSh)<input type="number" inputMode="numeric" value={fAmount} onChange={(e) => setFAmount(e.target.value)} min={0} /></label>
              <label>Aina ya Bima<input value={fInsType} onChange={(e) => setFInsType(e.target.value)} placeholder="Comprehensive, Third Party" /></label>
              <label>Muda (Miezi)<input type="number" inputMode="numeric" value={fMonths} onChange={(e) => setFMonths(e.target.value)} min={1} /></label>
              <label>Maelezo<input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
              <button type="submit">Hifadhi</button>
            </form>
          )}
          {form === "edit" && (
            <form onSubmit={submitEdit}>
              <h3>Set Targets &amp; Days / Edit Vehicle</h3>
              <label>Vehicle Number / Name<input value={eName} onChange={(e) => setEName(e.target.value)} required /></label>
              <label>Vehicle Type
                <select value={eType} onChange={(e) => {
                  setEType(e.target.value);
                  const p = PRESETS.find((x) => x.key === e.target.value);
                  if (p) { setEDays(String(p.days)); setEDaily(String(p.daily)); }
                }}>
                  {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </label>
              <label>Day Target (TSh)<input type="number" inputMode="numeric" value={eDaily} onChange={(e) => setEDaily(e.target.value)} required min={1} /></label>
              <label>Siku za Kufanya Kazi kwa Wiki<input type="number" inputMode="numeric" value={eDays} onChange={(e) => setEDays(e.target.value)} required min={1} max={7} /></label>
              <p className="hint">Week Target: {tsh((Number(eDaily) || 0) * (Number(eDays) || 0))}</p>
              <button type="submit">Hifadhi</button>
            </form>
          )}
          <button className="ghost" onClick={() => setForm(null)}>Sitisha / Cancel</button>
        </section>
      )}

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
              <input type="checkbox" checked={s.carry_over_on}
                onChange={(e) => run(() => setCarry(vehicle.id, month, e.target.checked), "Carry over imebadilishwa.")} />
              <span>Deni la mwezi huu lipelekwe mwezi unaofuata (Carry over)</span>
            </label>
          </>
        ) : <p className="empty">Inapakia...</p>}
      </section>

      <section className="card">
        <h3>Historia ya Deni</h3>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Tarehe</th><th>Aina</th><th>Awali</th><th>Mpya</th><th>Imelipwa</th><th>Imefungwa</th><th>Baada</th><th>Maelezo</th></tr>
            </thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={8}>No debt records for this month</td></tr>}
              {entries.map((e) => (
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

      <section className="card">
        <h3>Muhtasari wa Wiki za Mwezi</h3>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Week</th><th>Date Range</th><th>Working Days</th><th>Target</th><th>Income</th><th>Remaining</th></tr>
            </thead>
            <tbody>
              {weekRows.length === 0 && <tr><td colSpan={6}>No weeks</td></tr>}
              {weekRows.map((w) => (
                <tr key={w.week}>
                  <td><b>Week {w.week}</b></td>
                  <td>{shortDate(w.start)} – {shortDate(w.end)}</td>
                  <td className="purple">{wd}/{wd}</td>
                  <td className="blue">{tsh(w.target)}</td>
                  <td className="green">{tsh(w.income)}</td>
                  <td className="red">{tsh(w.remaining)}</td>
                </tr>
              ))}
              {weekRows.length > 0 && (
                <tr className="total-row">
                  <td><b>Monthly Total ({weekRows.length} weeks)</b></td>
                  <td>{wd} days/week</td><td></td>
                  <td className="blue">{tsh(weekRows.reduce((a, w) => a + w.target, 0))}</td>
                  <td className="green">{tsh(weekRows.reduce((a, w) => a + w.income, 0))}</td>
                  <td className="red">{tsh(weekRows[weekRows.length - 1].remaining)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Historia ya Mapato</h3>
        <ul className="list">
          {returns.length === 0 && <li className="empty">No income records for this month</li>}
          {returns.map((r) => (
            <li key={r.id}>
              <span>{r.day} {r.is_excess && "(ziada)"}</span>
              <b>{tsh(r.amount)}</b>
              <button className="danger" onClick={() => { if (confirm("Futa mapato haya?")) run(() => deleteReturn(r.id), "Mapato yamefutwa."); }}>Futa</button>
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
              <span>{p.day} · {paymentLabel(p.payment_type)}{p.note ? ` · ${p.note}` : ""}</span>
              <b className="green">{tsh(p.amount)}</b>
              <button className="danger" onClick={() => removeRecord("payment-records", p.id)}>Futa</button>
            </li>
          ))}
        </ul>
      </section>

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
    </div>
  );
}
