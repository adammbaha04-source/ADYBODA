import { useEffect, useState, type FormEvent } from "react";
import { addExpense, addMakato, deleteExpense, getExpenseSummary, listExpenses } from "./api";
import { todayYMD, tsh } from "./format";
import type { ExpenseSummary, PersonalExpense } from "./types";

const CATEGORIES = [
  { key: "binafsi", label: "Binafsi" },
  { key: "chakula", label: "Chakula" },
  { key: "ofisi", label: "Ofisi" },
  { key: "mgonjwa", label: "Mgonjwa" },
  { key: "hospitali", label: "Hospitali" },
  { key: "michango", label: "Michango" },
  { key: "vocha", label: "Vocha" },
  { key: "umeme", label: "Umeme" },
  { key: "maji", label: "Maji" },
  { key: "mavazi", label: "Mavazi" },
  { key: "mengineyo", label: "Mengineyo" },
];

const MAKATO_TYPES = [
  { key: "pesafasta", label: "Pesafasta" },
  { key: "atm", label: "ATM" },
  { key: "mitandao", label: "Mitandao ya Simu" },
];

// Same fee bands as the server (fleet/fees.py). The server is the one that saves the fee.
const FEE_BANDS: Record<string, [number, number][]> = {
  pesafasta: [[19999, 1100], [39999, 1300], [99999, 1400], [199999, 1500], [299000, 1700], [400000, 1800]],
  atm: [[199999, 2000], [400000, 2200]],
  mitandao: [[100000, 2500], [500000, 3500], [1000000, 4000]],
};
function feeFor(kind: string, amount: number): number {
  if (amount <= 0) return 0;
  for (const [limit, fee] of FEE_BANDS[kind] ?? []) if (amount <= limit) return fee;
  return 0;
}

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  [...CATEGORIES, { key: "makato", label: "Makato" }].map((c) => [c.key, c.label]),
);

export default function ExpensesPage({ month }: { month: string }) {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [items, setItems] = useState<PersonalExpense[]>([]);
  const [form, setForm] = useState<null | "expense" | "makato">(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [day, setDay] = useState(todayYMD());
  const [category, setCategory] = useState("binafsi");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [mType, setMType] = useState("");
  const [mTx, setMTx] = useState("");

  async function load() {
    try {
      const [s, l] = await Promise.all([getExpenseSummary(month), listExpenses(month)]);
      setSummary(s);
      setItems(l);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { load(); setForm(null); setNotice(""); }, [month]);

  async function submitExpense(e: FormEvent) {
    e.preventDefault();
    try {
      await addExpense(day, category, Number(amount), note.trim());
      setNotice("Matumizi yamehifadhiwa.");
      setAmount(""); setNote(""); setForm(null);
      load();
    } catch (err) { setError((err as Error).message); }
  }

  async function submitMakato(e: FormEvent) {
    e.preventDefault();
    try {
      await addMakato(day, mType, Number(mTx), note.trim());
      setNotice("Makato yamehifadhiwa.");
      setMTx(""); setNote(""); setMType(""); setForm(null);
      load();
    } catch (err) { setError((err as Error).message); }
  }

  async function remove(id: number) {
    if (!confirm("Futa rekodi hii?")) return;
    try { await deleteExpense(id); load(); }
    catch (err) { setError((err as Error).message); }
  }

  function openForm(f: "expense" | "makato") {
    setForm((cur) => (cur === f ? null : f));
    setDay(todayYMD());
    setNote("");
    setNotice("");
  }

  const fee = feeFor(mType, Number(mTx) || 0);

  return (
    <>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <section className="card">
        <h3>Jumla ya Matumizi</h3>
        <div className="total-box">
          <span>TOTAL EXPENSES</span>
          <b className="red">{tsh(summary?.total_personal ?? 0)}</b>
        </div>
        <div className="cat-grid">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="cat">
              <span>{c.label}</span><b>{tsh(summary?.categories[c.key] ?? 0)}</b>
            </div>
          ))}
          <div className="cat"><span>Makato</span><b>{tsh(summary?.categories.makato ?? 0)}</b></div>
        </div>
        {summary && (
          <>
            <h4 className="sub-title">Kutoka kwenye magari (mwezi huu)</h4>
            <div className="cat-grid">
              <div className="cat"><span>Service</span><b>{tsh(summary.vehicle.service)}</b></div>
              <div className="cat"><span>Tairi</span><b>{tsh(summary.vehicle.tairi)}</b></div>
              <div className="cat"><span>Bima</span><b>{tsh(summary.vehicle.bima)}</b></div>
              <div className="cat"><span>Deni</span><b>{tsh(summary.vehicle.deni)}</b></div>
              <div className="cat"><span>Malipo</span><b>{tsh(summary.vehicle.malipo)}</b></div>
            </div>
          </>
        )}
      </section>

      <div className="expense-buttons">
        <button className="btn-green" onClick={() => openForm("expense")}>Matumizi Mengine</button>
        <button className="btn-purple" onClick={() => openForm("makato")}>Makato</button>
      </div>

      {form === "expense" && (
        <section className="card form-card">
          <form onSubmit={submitExpense}>
            <h3>Ongeza Matumizi</h3>
            <label>Tarehe<input type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></label>
            <label>Aina ya Matumizi
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>
            <label>Kiasi (TSh)<input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} required min={1} /></label>
            <label>Maelezo<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Maelezo ya matumizi" /></label>
            <button type="submit">Hifadhi</button>
            <button type="button" className="ghost" onClick={() => setForm(null)}>Sitisha</button>
          </form>
        </section>
      )}

      {form === "makato" && (
        <section className="card form-card">
          <form onSubmit={submitMakato}>
            <h3>Ongeza Makato</h3>
            <label>Tarehe<input type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></label>
            <label>Aina ya Makato
              <select value={mType} onChange={(e) => setMType(e.target.value)} required>
                <option value="">Chagua aina ya makato</option>
                {MAKATO_TYPES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
            <label>Kiasi cha Muamala (TSh)<input type="number" inputMode="numeric" value={mTx} onChange={(e) => setMTx(e.target.value)} required min={1} /></label>
            <label>Makato (TSh) — otomatiki<input value={fee ? String(fee) : ""} readOnly className="readonly" /></label>
            <label>Maelezo<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Maelezo ya ziada" /></label>
            <button type="submit" disabled={!fee}>Hifadhi Makato</button>
            <button type="button" className="ghost" onClick={() => setForm(null)}>Sitisha</button>
          </form>
        </section>
      )}

      <section className="card">
        <h3>Orodha ya Matumizi</h3>
        <ul className="list">
          {items.length === 0 && <li className="empty">No expenses for this period</li>}
          {items.map((x) => (
            <li key={x.id}>
              <span>{x.day} · {CAT_LABEL[x.category] ?? x.category}{x.category === "makato" && x.makato_type ? ` (${x.makato_type})` : ""}{x.note ? ` · ${x.note}` : ""}</span>
              <b className={x.category === "makato" ? "purple" : "red"}>{tsh(x.amount)}</b>
              <button className="danger" onClick={() => remove(x.id)}>Futa</button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
