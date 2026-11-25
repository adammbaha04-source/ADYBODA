import { useEffect, useState, type FormEvent } from "react";
import { addManualEntry, getDebt } from "./api";
import { shortDate, todayYMD, tsh } from "./format";
import type { DebtEntry, DebtSummary, Vehicle } from "./types";
import "./DebtPage.css";

type Item = { vehicle: Vehicle; s: DebtSummary; entries: DebtEntry[] };
type Tab = "mine" | "drivers" | "all";
type Mode = "debt" | "payment";

interface Props {
  vehicles: Vehicle[];
  month: string;
  onNavigate?: (page: string) => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "mine", label: "My Debts" },
  { key: "drivers", label: "Driver Debts" },
  { key: "all", label: "All Debts" },
];

function currentDriver(v: Vehicle): string {
  const periods = [...(v.driver_periods ?? [])].sort((a, b) => a.from_date.localeCompare(b.from_date));
  return periods.length ? periods[periods.length - 1].driver_name : "";
}

function Avatar() {
  return (
    <svg viewBox="0 0 64 64" className="dm-avatar" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#dbeafe" />
      <circle cx="32" cy="27" r="11" fill="#fcd9b6" />
      <path d="M20 24c0-8 5-12 12-12s12 4 12 12c-3-2-7-3-12-3s-9 1-12 3z" fill="#1d4ed8" />
      <path d="M13 58c2-12 9-17 19-17s17 5 19 17" fill="#1d4ed8" />
    </svg>
  );
}

function Ring({ percent, color }: { percent: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg viewBox="0 0 64 64" className="dm-ring" aria-label={`${Math.round(p)}% completed`}>
      <circle cx="32" cy="32" r={r} className="dm-ring-track" />
      <circle
        cx="32"
        cy="32"
        r={r}
        className="dm-ring-fill"
        stroke={color}
        strokeDasharray={c}
        strokeDashoffset={c - (p / 100) * c}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="37" textAnchor="middle" className="dm-ring-text">
        {Math.round(p)}%
      </text>
    </svg>
  );
}

function DetailTable({ entries }: { entries: DebtEntry[] }) {
  if (entries.length === 0) return <p className="dm-empty">No debt records this month</p>;
  return (
    <div className="dm-details">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Before</th>
            <th>New</th>
            <th>Paid</th>
            <th>After</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{shortDate(e.date)}</td>
              <td className="blue">{tsh(e.previous_debt)}</td>
              <td className="red">{e.new_debt > 0 ? "+" + tsh(e.new_debt) : tsh(0)}</td>
              <td className="green">{tsh(e.paid_debt)}</td>
              <td className="orange"><b>{tsh(e.remaining_debt)}</b></td>
              <td>{e.notes || e.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DebtPage({ vehicles, month, onNavigate }: Props) {
  const [fMonth, setFMonth] = useState(month);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<Tab>("mine");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const [formMode, setFormMode] = useState<Mode | null>(null);
  const [fVehicle, setFVehicle] = useState("");
  const [fDay, setFDay] = useState(todayYMD());
  const [fAmount, setFAmount] = useState("");
  const [fNote, setFNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const list = await Promise.all(
        vehicles.map((v) =>
          getDebt(v.id, fMonth).then((d) => ({ vehicle: v, s: d.summary, entries: d.entries })),
        ),
      );
      setItems(list);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { setFMonth(month); }, [month]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fMonth, vehicles.map((v) => v.id).join(",")]);

  // Totals (all vehicles, this month)
  const total = items.reduce((a, i) => a + i.s.starting_debt + i.s.debt_added, 0);
  const paid = items.reduce((a, i) => a + i.s.payments, 0);
  const pending = items.reduce((a, i) => a + i.s.ending_debt, 0);
  const drivers = new Set(vehicles.map(currentDriver).filter(Boolean)).size;

  const visible = items.filter((i) => {
    if (tab === "mine") return i.s.ending_debt > 0;
    if (tab === "drivers") return currentDriver(i.vehicle) !== "";
    return true;
  });

  const [y, m] = fMonth.split("-").map(Number);
  const monthTitle = new Date(y, (m || 1) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });

  function openForm(mode: Mode, vehicleId?: number) {
    setFormMode(mode);
    setFVehicle(vehicleId ? String(vehicleId) : "");
    setFDay(todayYMD());
    setFAmount("");
    setFNote("");
    setNotice("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!formMode) return;
    setSaving(true);
    try {
      await addManualEntry(
        Number(fVehicle),
        formMode === "debt" ? "MANUAL_DEBT" : "MANUAL_PAYMENT",
        fDay,
        Number(fAmount),
        fNote.trim(),
      );
      setNotice(formMode === "debt" ? "Debt added" : "Payment recorded");
      setFormMode(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const stats = [
    { cls: "blue", icon: "▤", label: "Total Debt", value: tsh(total) },
    { cls: "green", icon: "✔", label: "Paid", value: tsh(paid) },
    { cls: "orange", icon: "◷", label: "Pending", value: tsh(pending) },
    { cls: "purple", icon: "👥", label: "Drivers", value: String(drivers) },
  ];

  return (
    <div className="dm">
      {error && <p className="dm-error">{error}</p>}
      {notice && <p className="dm-notice">{notice}</p>}

      <header className="dm-head">
        <div className="dm-title">
          <span className="dm-bag" aria-hidden="true">💰</span>
          <div>
            <h2>Deni Management</h2>
            <p>Track and manage all debts easily</p>
          </div>
        </div>
        <label className="dm-month">
          <span>📅 {monthTitle} ▾</span>
          <input
            type="month"
            className="dm-month-input"
            value={fMonth}
            onChange={(e) => setFMonth(e.target.value)}
            aria-label="Month"
          />
        </label>
      </header>

      <section className="dm-stats">
        {stats.map((s) => (
          <div key={s.label} className={`dm-stat ${s.cls}`}>
            <span className="dm-icon" aria-hidden="true">{s.icon}</span>
            <span>{s.label}</span>
            <b>{s.value}</b>
          </div>
        ))}
      </section>

      <nav className="dm-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {formMode && (
        <form className="dm-form" onSubmit={submit}>
          <h3>{formMode === "debt" ? "Add Debt" : "Record Payment"}</h3>
          <label>
            Vehicle
            <select value={fVehicle} onChange={(e) => setFVehicle(e.target.value)} required>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={fDay} onChange={(e) => setFDay(e.target.value)} required />
          </label>
          <label>
            Amount (TSh)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={fAmount}
              onChange={(e) => setFAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Note
            <input value={fNote} onChange={(e) => setFNote(e.target.value)} />
          </label>
          <div className="dm-form-actions">
            <button type="button" className="dm-ghost" onClick={() => setFormMode(null)}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      )}

      <section className="dm-list">
        {visible.length === 0 && <p className="dm-empty">No debts to show</p>}
        {visible.map((i) => {
          const due = i.s.starting_debt + i.s.debt_added;
          const pct = due > 0 ? (i.s.payments / due) * 100 : 0;
          const isPending = i.s.ending_debt > 0;
          const isOpen = openId === i.vehicle.id;
          const tone = isPending ? "red" : "green";
          return (
            <article key={i.vehicle.id} className="dm-card">
              <div className="dm-card-main">
                <div className="dm-card-top">
                  <div className="dm-who">
                    <Avatar />
                    <div>
                      <h4>{i.vehicle.name}</h4>
                      <span className="dm-type">{i.vehicle.vehicle_type}</span>
                    </div>
                  </div>
                  <div className="dm-amount-col">
                    <span className={`dm-pill ${isPending ? "pending" : "paid"}`}>
                      {isPending ? "PENDING" : "PAID"}
                    </span>
                    <b className={tone}>{tsh(i.s.ending_debt)}</b>
                  </div>
                </div>

                <div className="dm-card-body">
                  <div className="dm-metrics">
                    <div>
                      <span>Weekly Target</span>
                      <b>{tsh(i.s.weekly_target)}</b>
                    </div>
                    <div>
                      <span>Carry Over</span>
                      <b>{tsh(i.s.starting_debt)}</b>
                    </div>
                  </div>
                  <div className="dm-ring-wrap">
                    <Ring percent={pct} color={isPending ? "#ef4444" : "#10b981"} />
                    <div className="dm-balance">
                      <span>Paid</span>
                      <b className="green">{tsh(i.s.payments)}</b>
                      <span>Balance</span>
                      <b className="red">{tsh(i.s.ending_debt)}</b>
                    </div>
                  </div>
                </div>

                <div className="dm-bar">
                  <span className={tone} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="dm-bar-labels">
                  <span>{Math.round(pct)}% Completed</span>
                  <span className={`${tone} dm-due`}>Due: {isPending ? "Ongoing" : "Cleared"}</span>
                </div>
              </div>

              <div className="dm-card-actions">
                <button className="dm-btn dark" onClick={() => openForm("payment", i.vehicle.id)}>
                  Record Payment
                </button>
                <button className="dm-btn" onClick={() => setOpenId(isOpen ? null : i.vehicle.id)}>
                  {isOpen ? "Hide Details" : "View Details"}
                </button>
                <button className="dm-btn" onClick={() => openForm("debt", i.vehicle.id)}>
                  Manage Debt
                </button>
              </div>

              {isOpen && <DetailTable entries={i.entries} />}
            </article>
          );
        })}
      </section>

      <section className="dm-quick">
        <h3>💡 Quick Actions</h3>
        <div className="dm-quick-grid">
          <button className="qa green" onClick={() => openForm("debt")}>
            <b>+ Add Debt</b>
            <small>New debt</small>
          </button>
          <button className="qa blue" onClick={() => openForm("payment")}>
            <b>Record Payment</b>
            <small>Make payment</small>
          </button>
          <button className="qa orange" onClick={() => onNavigate?.("reports")}>
            <b>View Report</b>
            <small>Debt report</small>
          </button>
          <button className="qa purple" onClick={() => onNavigate?.("users")}>
            <b>Manage Drivers</b>
            <small>Drivers &amp; Debts</small>
          </button>
        </div>
      </section>

      <footer className="dm-footer">
        <span className="dm-brand">AdyBajaj… <em>Your Business Partner</em></span>
        <span className="dm-tagline">Keep Your Debts Under Control!</span>
      </footer>
    </div>
  );
}
