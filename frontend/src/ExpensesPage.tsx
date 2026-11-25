import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
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

// Icon + accent colour of each category card.
const CAT_STYLE: Record<string, { icon: string; color: string }> = {
  binafsi: { icon: "👥", color: "#2563eb" },
  chakula: { icon: "🍴", color: "#f97316" },
  ofisi: { icon: "🏠", color: "#16a34a" },
  mgonjwa: { icon: "🔧", color: "#7c3aed" },
  hospitali: { icon: "🛏️", color: "#dc2626" },
  michango: { icon: "🔁", color: "#22c55e" },
  vocha: { icon: "🚗", color: "#f59e0b" },
  umeme: { icon: "☂️", color: "#3b82f6" },
  maji: { icon: "⛽", color: "#7c3aed" },
  mavazi: { icon: "📱", color: "#22c55e" },
  mengineyo: { icon: "🛒", color: "#06b6d4" },
  makato: { icon: "🎁", color: "#f97316" },
};

const MONTHS_SW = ["Januari", "Februari", "Machi", "Aprili", "Mei", "Juni", "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba"];

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const idx = Number(m) - 1;
  if (!y || !(idx >= 0 && idx <= 11)) return month;
  return `${MONTHS_SW[idx]} ${y}`;
}

const pctOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const clamp = (n: number) => Math.max(0, Math.min(100, n));

function Ring({ pct, id, size = 84 }: { pct: number; id: string; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = clamp(pct);
  const mid = size / 2;
  return (
    <svg className="xp-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#a3e635" />
        </linearGradient>
      </defs>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={stroke} />
      <circle
        cx={mid} cy={mid} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(c * p) / 100} ${c}`} transform={`rotate(-90 ${mid} ${mid})`}
      />
      <text x={mid} y={mid} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={size * 0.21} fontWeight="700">
        {p.toFixed(p === 100 || p === 0 ? 0 : 1)}%
      </text>
    </svg>
  );
}

export default function ExpensesPage({ month }: { month: string }) {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [items, setItems] = useState<PersonalExpense[]>([]);
  const [form, setForm] = useState<null | "expense" | "makato">(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showVeh, setShowVeh] = useState(true);

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

  const total = summary?.total_personal ?? 0;
  const malipo = summary?.vehicle.malipo ?? 0;
  const share = pctOf(total, malipo);
  const catRows = [...CATEGORIES, { key: "makato", label: "Makato" }];
  const vehRows = [
    { key: "service", label: "Service", icon: "🔧", color: "#2563eb", value: summary?.vehicle.service ?? 0 },
    { key: "tairi", label: "Tairi", icon: "🛞", color: "#f97316", value: summary?.vehicle.tairi ?? 0 },
    { key: "bima", label: "Bima", icon: "🛡️", color: "#16a34a", value: summary?.vehicle.bima ?? 0 },
    { key: "deni", label: "Deni", icon: "📋", color: "#7c3aed", value: summary?.vehicle.deni ?? 0 },
  ];

  return (
    <>
      <style>{CSS}</style>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <header className="xp-head">
        <div className="xp-head-l">
          <span className="xp-head-ico">👤</span>
          <div>
            <h2>Matumizi Binafsi</h2>
            <p>Matumizi yako ya kibinafsi kwenye AdyBajaj</p>
          </div>
        </div>
        <span className="xp-month">📅 {monthLabel(month)}</span>
      </header>

      <section className="xp-hero">
        <div className="xp-hero-l">
          <span className="xp-hero-ico">👛</span>
          <div className="xp-hero-t">
            <small>Jumla ya Matumizi Binafsi</small>
            <b>{tsh(total)}</b>
            <div className="xp-hero-bar"><span style={{ width: `${clamp(share)}%` }} /></div>
          </div>
        </div>
        <div className="xp-hero-r">
          <Ring id="xp-g1" pct={share} />
          <div className="xp-hero-rt">
            <small>ya Malipo Yako</small>
            <b>{tsh(malipo)}</b>
            <i>(Jumla ya Malipo)</i>
          </div>
        </div>
      </section>

      <section className="xp-grid">
        {catRows.map((c) => {
          const st = CAT_STYLE[c.key] ?? { icon: "•", color: "#64748b" };
          const v = summary?.categories[c.key] ?? 0;
          const pct = pctOf(v, total);
          return (
            <div key={c.key} className="xp-cat" style={{ "--c": st.color } as CSSProperties}>
              <span className="xp-cat-ico">{st.icon}</span>
              <div className="xp-cat-body">
                <div className="xp-cat-top"><b>{c.label}</b><i>{pct.toFixed(1)}%</i></div>
                <div className="xp-cat-amt">{tsh(v)}</div>
                <div className="xp-bar"><span style={{ width: `${clamp(pct)}%` }} /></div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="xp-veh">
        <button type="button" className="xp-veh-head" onClick={() => setShowVeh((v) => !v)} aria-expanded={showVeh}>
          <span className="xp-veh-ico">🚗</span>
          <b>Kutoka kwenye magari (mwezi huu)</b>
          <span className={"xp-chev" + (showVeh ? " open" : "")}>⌃</span>
        </button>
        {showVeh && (
          <div className="xp-veh-grid">
            {vehRows.map((v) => {
              const pct = pctOf(v.value, malipo);
              return (
                <div key={v.key} className="xp-chip" style={{ "--c": v.color } as CSSProperties}>
                  <div className="xp-chip-top">
                    <span className="xp-chip-ico">{v.icon}</span>
                    <small>{v.label}</small>
                  </div>
                  <i className="xp-chip-pct">{pct.toFixed(1)}%</i>
                  <b>{tsh(v.value)}</b>
                  <div className="xp-bar"><span style={{ width: `${clamp(pct)}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="xp-all">
        <span className="xp-all-ico">🧮</span>
        <div className="xp-all-t">
          <b>Malipo Yote</b>
          <small>Jumla ya malipo ya mwezi huu</small>
        </div>
        <span className="xp-all-amt">{tsh(malipo)}</span>
        <Ring id="xp-g2" pct={malipo > 0 ? 100 : 0} size={64} />
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

// Styles of this page (prefix xp- so nothing else in the app is touched).
const CSS = `
.xp-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;margin:0 0 12px;border-radius:22px;background:linear-gradient(135deg,#f4f8ff,#e6efff);box-shadow:0 6px 18px rgba(20,50,110,.14)}
.xp-head-l{display:flex;align-items:center;gap:12px;min-width:0}
.xp-head-ico{flex:none;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;font-size:24px;background:linear-gradient(145deg,#3b82f6,#1d4ed8);box-shadow:0 4px 10px rgba(37,99,235,.45)}
.xp-head h2{margin:0;font-size:19px;line-height:1.15;color:#0b2a5b}
.xp-head p{margin:3px 0 0;font-size:12px;font-style:italic;color:#3b5a8c}
.xp-month{flex:none;padding:9px 12px;border-radius:999px;font-size:13px;font-weight:600;color:#0b2a5b;background:#fff;box-shadow:0 3px 10px rgba(20,50,110,.15);white-space:nowrap}

.xp-hero{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;padding:16px;margin:0 0 12px;border-radius:24px;color:#fff;background:linear-gradient(135deg,#0b2a6b,#0a1f4d);box-shadow:0 10px 24px rgba(10,31,77,.35)}
.xp-hero-l{display:flex;align-items:center;gap:12px;flex:1 1 200px;min-width:0}
.xp-hero-ico{flex:none;font-size:38px;line-height:1}
.xp-hero-t{flex:1;min-width:0}
.xp-hero-t small{display:block;font-size:13px;font-weight:600;color:#dbe7ff}
.xp-hero-t b{display:block;margin:2px 0 8px;font-size:27px;line-height:1.1;color:#fde047}
.xp-hero-bar{height:9px;border-radius:999px;background:rgba(255,255,255,.18);overflow:hidden}
.xp-hero-bar span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#a3e635)}
.xp-hero-r{display:flex;align-items:center;gap:10px;flex:1 1 190px;padding-left:14px;border-left:1px solid rgba(255,255,255,.22)}
.xp-hero-rt small{display:block;font-size:12px;font-weight:600;color:#dbe7ff}
.xp-hero-rt b{display:block;font-size:17px;color:#fff}
.xp-hero-rt i{font-size:11px;color:#b9cdf5}
.xp-ring{flex:none}

.xp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 12px}
.xp-cat{display:flex;align-items:center;gap:9px;padding:10px;border-radius:18px;min-width:0;background:#fff;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--c) 14%,#fff));border:1px solid color-mix(in srgb,var(--c) 18%,#fff);box-shadow:0 5px 14px rgba(20,50,110,.1)}
.xp-cat-ico{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:21px;background:color-mix(in srgb,var(--c) 18%,#fff);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--c) 30%,#fff)}
.xp-cat-body{flex:1;min-width:0}
.xp-cat-top{display:flex;align-items:center;justify-content:space-between;gap:4px}
.xp-cat-top b{font-size:14px;color:#0b2a5b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xp-cat-top i{font-style:normal;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;color:var(--c);background:color-mix(in srgb,var(--c) 16%,#fff)}
.xp-cat-amt{margin:2px 0 6px;font-size:13px;font-weight:700;color:#0b2a5b;white-space:nowrap}
.xp-bar{height:6px;border-radius:999px;background:rgba(15,42,92,.12);overflow:hidden}
.xp-bar span{display:block;height:100%;border-radius:999px;background:var(--c,#16a34a)}

.xp-veh{margin:0 0 12px;border-radius:22px;overflow:hidden;background:linear-gradient(135deg,#0b2a6b,#0a1f4d);box-shadow:0 8px 20px rgba(10,31,77,.3)}
.xp-veh-head{display:flex;align-items:center;gap:10px;width:100%;padding:13px 14px;border:0;background:transparent;color:#fff;font-size:15px;text-align:left;cursor:pointer}
.xp-veh-head b{flex:1}
.xp-veh-ico{font-size:24px}
.xp-chev{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.18);font-size:16px;transform:rotate(180deg);transition:transform .2s}
.xp-chev.open{transform:rotate(0)}
.xp-veh-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 9px 10px}
.xp-chip{padding:8px 7px;border-radius:15px;min-width:0;background:linear-gradient(160deg,#fff,color-mix(in srgb,var(--c) 16%,#fff));border:1px solid color-mix(in srgb,var(--c) 20%,#fff)}
.xp-chip-top{display:flex;align-items:center;gap:4px}
.xp-chip-ico{font-size:16px}
.xp-chip-top small{font-size:11px;font-weight:700;color:#0b2a5b}
.xp-chip-pct{display:block;width:fit-content;margin:3px 0 2px auto;font-style:normal;font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;color:var(--c);background:color-mix(in srgb,var(--c) 18%,#fff)}
.xp-chip b{display:block;margin-bottom:5px;font-size:11px;color:#0b2a5b;white-space:nowrap}

.xp-all{display:flex;align-items:center;gap:10px;padding:12px 14px;margin:0 0 12px;border-radius:22px;color:#fff;background:linear-gradient(135deg,#0b2a6b,#0a1f4d);box-shadow:0 8px 20px rgba(10,31,77,.3)}
.xp-all-ico{flex:none;font-size:30px}
.xp-all-t{flex:1;min-width:0}
.xp-all-t b{display:block;font-size:17px}
.xp-all-t small{display:block;font-size:11px;font-style:italic;color:#c7d8fa}
.xp-all-amt{flex:none;padding:10px 14px;border-radius:999px;font-size:17px;font-weight:800;color:#0b2a5b;background:linear-gradient(90deg,#f59e0b,#fbbf24);box-shadow:0 4px 12px rgba(245,158,11,.4);white-space:nowrap}

@media (max-width:380px){
  .xp-veh-grid{grid-template-columns:1fr 1fr}
  .xp-hero-t b{font-size:23px}
  .xp-all-amt{font-size:14px;padding:8px 10px}
}
`;
