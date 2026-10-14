import { useState, type FormEvent } from "react";
import { createIncome, updateIncome, type IncomeRow } from "./incomeApi";
import { todayYMD, tsh } from "./format";
import "./income.css";

// Fomu ya kujaza Income: mwezi wa record, tarehe ya kuanzia, ya mwisho, wiki, tarehe ya malipo, kiasi, tiki ya ziada.
export default function IncomeForm(props: {
  vehicleId: number; workingDays: number; includeWeek5: boolean; defaultMonth: string;
  editing?: IncomeRow | null; onSaved: () => void; onCancel: () => void;
}) {
  const { vehicleId, includeWeek5, defaultMonth, editing, onSaved, onCancel } = props;
  const startMonth = editing?.record_month || defaultMonth;

  const [month, setMonth] = useState(startMonth);
  const [week, setWeek] = useState<number | "">(editing?.week_number ?? ""); // chosen by hand, after the dates
  const [start, setStart] = useState(editing?.period_start || "");
  const [end, setEnd] = useState(editing?.period_end || "");
  const [payDay, setPayDay] = useState(editing?.day || todayYMD());
  const [amount, setAmount] = useState(editing ? String(editing.amount) : ""); // empty on purpose
  const [excess, setExcess] = useState(editing?.is_excess ?? false);
  const [note, setNote] = useState(editing?.note || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const week5Off = week === 5 && !includeWeek5;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!week) { setError("Chagua namba ya wiki."); return; }
    if (!month) { setError("Chagua mwezi wa record."); return; }
    if (!value || value < 1) { setError("Andika kiasi kilicholipwa."); return; }
    if (start > end) { setError("Tarehe ya mwisho iwe baada ya tarehe ya kuanzia."); return; }
    if (week5Off) { setError("Week 5 imezimwa kwa gari hili. Iwashe kwanza (Week 5: ON)."); return; }
    const body = {
      day: payDay, amount: value, is_excess: excess, record_month: month, week_number: week,
      period_start: start, period_end: end, note: note.trim(),
    };
    setBusy(true);
    try {
      if (editing) await updateIncome(editing.id, body); else await createIncome(vehicleId, body);
      onSaved();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form className="income-form" onSubmit={submit}>
      <h3>{editing ? "Hariri Mapato" : "Ongeza Mapato"}</h3>

      <div className="rec-month">
        <b>Mwezi wa Record</b>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        <small>Mapato yatahesabiwa kwenye mwezi huu, hata kama unalipa tarehe tofauti.</small>
      </div>

      <label>Kuanzia Tarehe<input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
      <label>Mpaka Tarehe<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>

      <label>Namba ya Wiki
        <select value={week} onChange={(e) => setWeek(e.target.value ? Number(e.target.value) : "")} required>
          <option value="">Chagua wiki</option>
          {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>Wiki {w}</option>)}
        </select>
      </label>
      {week5Off && <p className="error">Week 5 imezimwa kwa gari hili. Iwashe kwanza kwenye ukurasa wa gari.</p>}

      <label>Tarehe ya Malipo<input type="date" value={payDay} onChange={(e) => setPayDay(e.target.value)} required /></label>

      <label>Kiasi (TSh)
        <input type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="mfano: 90000" required />
      </label>
      {Number(amount) > 0 && <p className="amount-preview">{tsh(Number(amount))}</p>}

      <label className="inline">
        <input type="checkbox" checked={excess} onChange={(e) => setExcess(e.target.checked)} />
        Hii ni Malipo ya Ziada (Excess) - Itapunguza Deni
      </label>
      {excess && <p className="hint">Pesa hii haihesabiwi kama income ya wiki. Inapunguza deni moja kwa moja.</p>}

      <label>Maelezo<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={busy}>{busy ? "Inahifadhi..." : "Hifadhi"}</button>
        <button type="button" className="ghost" onClick={onCancel}>Sitisha</button>
      </div>
    </form>
  );
}
