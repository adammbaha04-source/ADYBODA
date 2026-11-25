import { useEffect, useState, type FormEvent } from "react";
import { addManualEntry, getDebt, updateVehicle } from "./api";
import { shortDate, todayYMD, tsh } from "./format";
import type { DebtEntry, DebtSummary, DriverPeriod, Vehicle } from "./types";
import iconTarget from "./assets/icon-target.png";
import iconIncome from "./assets/icon-income.png";
import iconDays from "./assets/icon-days.png";
import iconProfit from "./assets/icon-profit.png";
import iconExpenses from "./assets/icon-expenses.png";
import "./DebtPage.css";

type DriverAccount = { username: string; full_name: string; phone: string; avatar: string };
type VehicleX = Vehicle & { debt_limit?: number | null; driver_account?: DriverAccount | null };

type Item = { vehicle: VehicleX; s: DebtSummary; entries: DebtEntry[] };
type Tab = "mine" | "drivers" | "all";
type Mode = "debt" | "payment";
type WeekEntry = DebtEntry & { week_number?: number | null };

interface Props {
  vehicles: Vehicle[];
  month: string;
  onNavigate?: (page: string) => void;
  /** Owner and manager: true. Driver view: false (hides limit editing). */
  canEditLimit?: boolean;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "mine", label: "My Debts" },
  { key: "drivers", label: "Driver Debts" },
  { key: "all", label: "All Debts" },
];

const WEEKS = ["ALL", "1", "2", "3", "4", "5"];

function latestDriver(v: Vehicle): DriverPeriod | undefined {
  const periods = [...(v.driver_periods ?? [])].sort((a, b) => a.from_date.localeCompare(b.from_date));
  return periods[periods.length - 1];
}

function driverInfo(v: VehicleX): { name: string; phone: string; avatar: string } | null {
  const acc = v.driver_account;
  const p = latestDriver(v);
  if (!acc && !p) return null;
  return {
    name: acc?.full_name || p?.driver_name || acc?.username || "",
    phone: acc?.phone || p?.phone || "",
    avatar: acc?.avatar || "",
  };
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function DefaultAvatar() {
  return (
    <svg viewBox="0 0 64 64" className="dm-avatar" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#dbeafe" />
      <circle cx="32" cy="27" r="11" fill="#fcd9b6" />
      <path d="M20 24c0-8 5-12 12-12s12 4 12 12c-3-2-7-3-12-3s-9 1-12 3z" fill="#1d4ed8" />
      <path d="M13 58c2-12 9-17 19-17s17 5 19 17" fill="#1d4ed8" />
    </svg>
  );
}

function DriverAvatar({ info }: { info: ReturnType<typeof driverInfo> }) {
  if (!info) return <DefaultAvatar />;
  if (info.avatar) return <img src={info.avatar} alt={info.name} className="dm-driver-photo" />;
  return <div className="dm-initials" aria-label={info.name}>{initials(info.name)}</div>;
}

type Part = { label: string; value: number; color: string };

// Donut chart split into parts; each part's share is its value over the total
function Donut({ parts }: { parts: Part[] }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  let offset = 0;
  return (
    <svg viewBox="0 0 64 64" className="dm-ring" aria-label="Debt breakdown">
      <circle cx="32" cy="32" r={r} className="dm-ring-track" />
      {total > 0 &&
        parts.map((p) => {
          const len = (Math.max(0, p.value) / total) * c;
          const seg = (
            <circle
              key={p.label}
              cx="32"
              cy="32"
              r={r}
              className="dm-ring-fill"
              stroke={p.color}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 32 32)"
            />
          );
          offset += len;
          return seg;
        })}
    </svg>
  );
}

function DetailTable({ entries }: { entries: DebtEntry[] }) {
  if (entries.length === 0) return <p className="dm-empty">No debt records</p>;
  return (
    <div className="dm-details">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Week</th>
            <th>Before</th>
            <th>New</th>
            <th>Paid</th>
            <th>After</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const w = (e as WeekEntry).week_number;
            return (
              <tr key={e.id}>
                <td>{shortDate(e.date)}</td>
                <td>{w ?? "-"}</td>
                <td className="blue">{tsh(e.previous_debt)}</td>
                <td className="red">{e.new_debt > 0 ? "+" + tsh(e.new_debt) : tsh(0)}</td>
                <td className="green">{tsh(e.paid_debt)}</td>
                <td className="orange"><b>{tsh(e.remaining_debt)}</b></td>
                <td>{e.notes || e.type}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DebtPage({ vehicles, month, onNavigate, canEditLimit = true }: Props) {
  const vs = vehicles as VehicleX[];

  const [fMonth, setFMonth] = useState(month);
  const [fWeek, setFWeek] = useState("ALL");
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<Tab>("mine");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [manageId, setManageId] = useState<number | null>(null);

  // Limits saved in this session, so the card updates right away
  const [limitOverride, setLimitOverride] = useState<Record<number, number | null>>({});
  const [limitInput, setLimitInput] = useState("");

  const [formMode, setFormMode] = useState<Mode | null>(null);
  const [fVehicle, setFVehicle] = useState("");
  const [fDay, setFDay] = useState(todayYMD());
  const [fAmount, setFAmount] = useState("");
  const [fNote, setFNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const list = await Promise.all(
        vs.map((v) =>
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

  function limitOf(v: VehicleX): number | null {
    if (v.id in limitOverride) return limitOverride[v.id];
    return v.debt_limit ?? null;
  }

  async function saveLimit(v: VehicleX) {
    const n = Number(limitInput);
    if (!n || n <= 0) {
      setError("Weka kiasi sahihi cha limit");
      return;
    }
    try {
      await updateVehicle(v.id, { debt_limit: n } as Partial<Vehicle>);
      setLimitOverride((o) => ({ ...o, [v.id]: n }));
      setNotice("Limit imehifadhiwa");
      setError("");
      setLimitInput("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const total = items.reduce((a, i) => a + i.s.starting_debt + i.s.debt_added, 0);
  const paid = items.reduce((a, i) => a + i.s.payments, 0);
  const pending = items.reduce((a, i) => a + i.s.ending_debt, 0);
  const drivers = new Set(vs.map((v) => driverInfo(v)?.name).filter(Boolean)).size;

  const visible = items.filter((i) => {
    if (tab === "mine") return i.s.ending_debt > 0;
    if (tab === "drivers") return driverInfo(i.vehicle) !== null;
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
    { cls: "blue", icon: iconTarget, label: "Total Debt", value: tsh(total) },
    { cls: "green", icon: iconIncome, label: "Paid", value: tsh(paid) },
    { cls: "orange", icon: iconDays, label: "Pending", value: tsh(pending) },
    { cls: "purple", icon: iconProfit, label: "Drivers", value: String(drivers) },
  ];

  return (
    <div className="dm">
      {error && <p className="dm-error">{error}</p>}
      {notice && <p className="dm-notice">{notice}</p>}

      <header className="dm-head">
        <div className="dm-title">
          <img src={iconExpenses} alt="" className="dm-title-icon" />
          <div>
            <h2>Deni Management</h2>
            <p>Track and manage all debts easily</p>
          </div>
        </div>
        <div className="dm-selectors">
          <label className="dm-pick">
            <span>Week ▾ {fWeek === "ALL" ? "All" : fWeek}</span>
            <select value={fWeek} onChange={(e) => setFWeek(e.target.value)} aria-label="Week">
              {WEEKS.map((w) => (
                <option key={w} value={w}>{w === "ALL" ? "All weeks" : `Week ${w}`}</option>
              ))}
            </select>
          </label>
          <label className="dm-pick">
            <span>📅 {monthTitle} ▾</span>
            <input
              type="month"
              value={fMonth}
              onChange={(e) => setFMonth(e.target.value)}
              aria-label="Month"
            />
          </label>
        </div>
      </header>

      <section className="dm-stats">
        {stats.map((s) => (
          <div key={s.label} className={`dm-stat ${s.cls}`}>
            <img src={s.icon} alt="" className="dm-stat-icon" />
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
              {vs.map((v) => (
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
          const id = i.vehicle.id;
          const info = driverInfo(i.vehicle);
          const limit = limitOf(i.vehicle);
          const hasLimit = limit !== null && limit > 0;
          const debtAdded = i.s.debt_added;
          const over = hasLimit && debtAdded > limit!;
          const debtPct = hasLimit ? (debtAdded / limit!) * 100 : 0;
          const remaining = hasLimit ? limit! - debtAdded : 0;
          const remainingPct = hasLimit ? Math.max(0, (remaining / limit!) * 100) : 0;

          const due = i.s.starting_debt + i.s.debt_added;
          const paidPct = due > 0 ? (i.s.payments / due) * 100 : 0;
          const isPending = i.s.ending_debt > 0;
          const isOpen = openId === id;
          const isManage = manageId === id;
          const entries = fWeek === "ALL"
            ? i.entries
            : i.entries.filter((e) => String((e as WeekEntry).week_number ?? "") === fWeek);
          const tone = isPending ? "red" : "green";

          const statusClass = !hasLimit ? "none" : over ? "over" : "safe";
          const statusLabel = !hasLimit ? "NO LIMIT" : over ? "OVER LIMIT" : "SAFE";
          const statusMsg = !hasLimit
            ? "No monthly limit set yet."
            : over
              ? `Driver is over the limit by ${tsh(debtAdded - limit!)}.`
              : `Still safe. ${tsh(remaining)} left before the limit.`;

          const parts: Part[] = [
            { label: "Debt payment", value: i.s.payments, color: "#16a34a" },
            { label: "Balance", value: i.s.ending_debt, color: "#dc2626" },
            { label: "Remaining debt", value: hasLimit ? Math.max(0, remaining) : 0, color: "#3b82f6" },
          ];

          return (
            <article key={id} className="dm-card">
              <div className="dm-card-main">
                <div className="dm-card-top">
                  <div className="dm-who">
                    <DriverAvatar info={info} />
                    <div>
                      <h4>{i.vehicle.name}</h4>
                      {info && (
                        <p className="dm-driver">
                          {info.name}
                          {info.phone && <span> · {info.phone}</span>}
                        </p>
                      )}
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
                      <span>Monthly Limit</span>
                      <b>{hasLimit ? tsh(limit!) : "Not set"}</b>
                    </div>
                    <div>
                      <span>{over ? "Over Limit By" : "Limit Remaining"}</span>
                      <b className={over ? "red" : ""}>
                        {hasLimit
                          ? over
                            ? tsh(debtAdded - limit!)
                            : `${tsh(remaining)} (${Math.round(remainingPct)}%)`
                          : "-"}
                      </b>
                    </div>
                  </div>
                  <div className="dm-donut-wrap">
                    <Donut parts={parts} />
                    <ul className="dm-legend">
                      {parts.map((p) => (
                        <li key={p.label}>
                          <i style={{ background: p.color }} />
                          <span>{p.label}</span>
                          <b>{tsh(p.value)}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="dm-limit-row">
                  <span className={`dm-status ${statusClass}`}>{statusLabel}</span>
                </div>
                <p className="dm-limit-msg">{statusMsg}</p>

                <div className="dm-bar-block">
                  <div className="dm-bar-labels">
                    <span>Debt</span>
                    <span>{hasLimit ? `${Math.round(debtPct)}% of limit` : "No limit"}</span>
                  </div>
                  <div className="dm-bar">
                    <span
                      className={over ? "limit-over" : "limit-safe"}
                      style={{ width: `${Math.min(100, debtPct)}%` }}
                    />
                  </div>
                </div>

                <div className="dm-bar-block">
                  <div className="dm-bar-labels">
                    <span>Debt payment</span>
                    <span className={`${tone} dm-due`}>
                      {Math.round(paidPct)}% paid · {isPending ? "Ongoing" : "Cleared"}
                    </span>
                  </div>
                  <div className="dm-bar">
                    <span className="green" style={{ width: `${Math.min(100, paidPct)}%` }} />
                  </div>
                </div>
              </div>

              <div className="dm-card-actions">
                <button className="dm-btn dark" onClick={() => openForm("payment", id)}>
                  Record Payment
                </button>
                <button className="dm-btn" onClick={() => setOpenId(isOpen ? null : id)}>
                  {isOpen ? "Hide Details" : "View Details"}
                </button>
                <button
                  className="dm-btn"
                  onClick={() => setManageId(isManage ? null : id)}
                >
                  {isManage ? "Close" : "Manage Debt"}
                </button>
              </div>

              {isManage && (
                <div className="dm-manage">
                  <h4>Manage Debt</h4>
                  <div className="dm-manage-stats">
                    <div>
                      <span>Limit</span>
                      <b>{hasLimit ? tsh(limit!) : "Not set"}</b>
                    </div>
                    <div>
                      <span>{over ? "Over limit by" : "Limit remaining"}</span>
                      <b className={over ? "red" : ""}>
                        {hasLimit
                          ? over
                            ? tsh(debtAdded - limit!)
                            : `${tsh(remaining)} (${Math.round(remainingPct)}%)`
                          : "-"}
                      </b>
                    </div>
                  </div>

                  {canEditLimit && (
                    <form
                      className="dm-limit-form"
                      onSubmit={(e: FormEvent) => { e.preventDefault(); saveLimit(i.vehicle); }}
                    >
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder={hasLimit ? "Change limit (TSh)" : "Set limit (TSh)"}
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        required
                      />
                      <button type="submit">Set limit</button>
                    </form>
                  )}

                  <button
                    type="button"
                    className="dm-btn wide"
                    onClick={() => openForm("debt", id)}
                  >
                    + Add debt for this vehicle
                  </button>
                </div>
              )}

              {isOpen && <DetailTable entries={entries} />}
            </article>
          );
        })}
      </section>

      <section className="dm-quick">
        <h3>Quick Actions</h3>
        <div className="dm-quick-grid">
          <button className="dm-qa green" onClick={() => openForm("debt")}>
            <img src={iconExpenses} alt="" />
            <span className="dm-qa-title">+ Add Debt</span>
            <span className="dm-qa-sub">New debt</span>
          </button>
          <button className="dm-qa blue" onClick={() => openForm("payment")}>
            <img src={iconIncome} alt="" />
            <span className="dm-qa-title">Record Payment</span>
            <span className="dm-qa-sub">Make payment</span>
          </button>
          <button className="dm-qa orange" onClick={() => onNavigate?.("reports")}>
            <img src={iconTarget} alt="" />
            <span className="dm-qa-title">View Report</span>
            <span className="dm-qa-sub">Debt report</span>
          </button>
          <button className="dm-qa purple" onClick={() => onNavigate?.("users")}>
            <img src={iconProfit} alt="" />
            <span className="dm-qa-title">Manage Drivers</span>
            <span className="dm-qa-sub">Drivers &amp; Debts</span>
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
