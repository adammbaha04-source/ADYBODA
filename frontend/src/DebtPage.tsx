import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addManualEntry, getDebtSummaries, updateVehicle, type DebtBundle } from "./api";
import { buildDebtCsv, downloadText, type ExportRow } from "./debtExport";
import { shortDate, todayYMD, tsh } from "./format";
import type { DebtEntry, DebtSummary, DriverPeriod, Vehicle } from "./types";
import iconTarget from "./assets/icon-target.png";
import iconIncome from "./assets/icon-income.png";
import iconDays from "./assets/icon-days.png";
import iconProfit from "./assets/icon-profit.png";
import iconExpenses from "./assets/icon-expenses.png";
import "./DebtPage.css";

type DriverAccount = { username: string; full_name: string; phone: string; avatar: string };
type VehicleX = Vehicle & { driver_account?: DriverAccount | null };

// month = whole-month numbers from the server (used for the limit and for downloads).
// view  = the same numbers narrowed to the selected week (used for the cards and totals).
type Item = { vehicle: VehicleX; month: DebtSummary; entries: DebtEntry[] };
type Row = Item & { view: { s: DebtSummary; entries: DebtEntry[] } };
type Tab = "pending" | "drivers" | "all";
type Mode = "debt" | "payment";

interface Props {
  vehicles: Vehicle[];
  month: string;
  onNavigate?: (page: string) => void;
  /** Owner and manager: true. Driver view: false (hides limit editing). */
  canEditLimit?: boolean;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
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

/**
 * Narrow one vehicle's month data to a single week.
 * Returns null when the vehicle has no records in that week.
 * Manual debts and manual payments have no week number, so they only show in "All weeks".
 */
function scopeToWeek(i: Item, week: string): Row["view"] | null {
  if (week === "ALL") return { s: i.month, entries: i.entries };
  const entries = i.entries.filter((e) => String(e.week_number ?? "") === week);
  if (entries.length === 0) return null;
  return {
    entries,
    s: {
      ...i.month,
      starting_debt: entries[0].previous_debt,
      debt_added: entries.reduce((a, e) => a + e.new_debt, 0),
      payments: entries.reduce((a, e) => a + e.paid_debt, 0),
      closed_debt: entries.reduce((a, e) => a + e.closed_debt, 0),
      ending_debt: entries[entries.length - 1].remaining_debt,
    },
  };
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

// Donut chart. The parts add up to what was due, so each slice is its share of that.
// A part that is above zero always gets a slice you can see (at least 5% of the ring),
// so a small payment is not lost. The centre shows the percent paid.
function Donut({ parts, centre }: { parts: Part[]; centre: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  const raw = parts.map((p) => {
    const v = Math.max(0, p.value);
    return v > 0 && total > 0 ? Math.max((v / total) * c, c * 0.05) : 0;
  });
  const scale = raw.reduce((a, n) => a + n, 0) || 1;
  let offset = 0;
  return (
    <svg viewBox="0 0 64 64" className="dm-ring" aria-label="Debt breakdown">
      <circle cx="32" cy="32" r={r} className="dm-ring-track" />
      {parts.map((p, idx) => {
        if (raw[idx] === 0) return null;
        const len = (raw[idx] / scale) * c;
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
      <text x="32" y="35" textAnchor="middle" fontSize="10" fontWeight="700" fill="#111827">{centre}</text>
    </svg>
  );
}

// All weeks of the month in date order, with a month total at the bottom.
function DetailTable({ entries, s, onDownload }: { entries: DebtEntry[]; s: DebtSummary; onDownload: () => void }) {
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
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{shortDate(e.date)}</td>
              <td>{e.week_number ?? "-"}</td>
              <td className="blue">{tsh(e.previous_debt)}</td>
              <td className="red">{e.new_debt > 0 ? "+" + tsh(e.new_debt) : tsh(0)}</td>
              <td className="green">{tsh(e.paid_debt)}</td>
              <td className="orange"><b>{tsh(e.remaining_debt)}</b></td>
              <td>{e.notes || e.type}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}><b>Month total</b></td>
            <td className="blue"><b>{tsh(s.starting_debt)}</b></td>
            <td className="red"><b>+{tsh(s.debt_added)}</b></td>
            <td className="green"><b>{tsh(s.payments)}</b></td>
            <td className="orange"><b>{tsh(s.ending_debt)}</b></td>
            <td />
          </tr>
        </tfoot>
      </table>
      <button type="button" className="dm-btn wide" onClick={onDownload}>⬇ Download this month (CSV)</button>
    </div>
  );
}

export default function DebtPage({ vehicles, month, onNavigate, canEditLimit = true }: Props) {
  const vs = vehicles as VehicleX[];

  const [fMonth, setFMonth] = useState(month);
  const [fWeek, setFWeek] = useState("ALL");
  const [bundles, setBundles] = useState<DebtBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>("pending");
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

  function clearMessages() {
    setError("");
    setNotice("");
  }

  useEffect(() => { setFMonth(month); }, [month]);

  // One request for all vehicles. If the month changes while a request is running,
  // the old answer is thrown away so it cannot overwrite the new one.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDebtSummaries(fMonth)
      .then((list) => {
        if (cancelled) return;
        setBundles(list);
        setError("");
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fMonth, reloadKey]);

  const items: Item[] = useMemo(() => {
    const byId = new Map(bundles.map((b) => [b.vehicle_id, b]));
    return (vehicles as VehicleX[]).flatMap((v) => {
      const b = byId.get(v.id);
      return b ? [{ vehicle: v, month: b.summary, entries: b.entries }] : [];
    });
  }, [vehicles, bundles]);

  function limitOf(v: VehicleX): number | null {
    if (v.id in limitOverride) return limitOverride[v.id];
    return v.debt_limit ?? null;
  }

  async function saveLimit(v: VehicleX) {
    const n = Number(limitInput);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid limit amount");
      return;
    }
    try {
      await updateVehicle(v.id, { debt_limit: n });
      setLimitOverride((o) => ({ ...o, [v.id]: n }));
      setNotice("Limit saved");
      setError("");
      setLimitInput("");
    } catch (e) {
      setNotice("");
      setError((e as Error).message);
    }
  }

  // Rows for the selected week. Vehicles with no records in that week are left out.
  const rows: Row[] = items.flatMap((i) => {
    const view = scopeToWeek(i, fWeek);
    return view ? [{ ...i, view }] : [];
  });

  const isPendingRow = (r: Row) => r.view.s.ending_debt > 0;
  const hasDriver = (r: Row) => driverInfo(r.vehicle) !== null;

  const visible = rows.filter((r) => {
    if (tab === "pending") return isPendingRow(r);
    if (tab === "drivers") return hasDriver(r);
    return true;
  });

  const counts: Record<Tab, number> = {
    pending: rows.filter(isPendingRow).length,
    drivers: rows.filter(hasDriver).length,
    all: rows.length,
  };

  // Totals follow what is on screen: same tab, same week.
  const total = visible.reduce((a, r) => a + r.view.s.starting_debt + r.view.s.debt_added, 0);
  const paid = visible.reduce((a, r) => a + r.view.s.payments, 0);
  const pending = visible.reduce((a, r) => a + r.view.s.ending_debt, 0);
  const drivers = new Set(visible.map((r) => driverInfo(r.vehicle)?.name).filter(Boolean)).size;

  const [y, m] = fMonth.split("-").map(Number);
  const monthTitle = new Date(y, (m || 1) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });

  // Downloads always use the whole month, all weeks, whatever week is selected on screen.
  function exportRow(i: Item): ExportRow {
    return { vehicle: i.vehicle.name, driver: driverInfo(i.vehicle)?.name ?? "", s: i.month, entries: i.entries };
  }
  function downloadVehicle(i: Item) {
    downloadText(`debt-${i.vehicle.name}-${fMonth}.csv`, buildDebtCsv([exportRow(i)], fMonth));
  }
  function downloadAll() {
    if (items.length === 0) {
      setError("No debt records to download");
      return;
    }
    downloadText(`debt-all-vehicles-${fMonth}.csv`, buildDebtCsv(items.map(exportRow), fMonth));
  }

  function openForm(mode: Mode, vehicleId?: number) {
    setFormMode(mode);
    setFVehicle(vehicleId ? String(vehicleId) : "");
    setFDay(todayYMD());
    setFAmount("");
    setFNote("");
    clearMessages();
  }

  function toggleManage(id: number) {
    setManageId((cur) => (cur === id ? null : id));
    setLimitInput(""); // a number typed on one card must not carry over to another
  }

  function changeTab(t: Tab) {
    setTab(t);
    clearMessages();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!formMode || saving) return;
    if (!fVehicle) {
      setError("Select a vehicle");
      return;
    }
    clearMessages();
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
      setReloadKey((k) => k + 1);
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
          <button type="button" className="dm-btn" onClick={downloadAll}>⬇ Download month</button>
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

      <nav className="dm-tabs" role="tablist" aria-label="Debt views">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => changeTab(t.key)}
          >
            {t.label} ({counts[t.key]})
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

      {tab === "drivers" && visible.length > 0 && (
        <section className="dm-details">
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Total debt</th>
                <th>Paid</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.vehicle.id}>
                  <td>{driverInfo(r.vehicle)?.name}</td>
                  <td>{r.vehicle.name}</td>
                  <td className="blue">{tsh(r.view.s.starting_debt + r.view.s.debt_added)}</td>
                  <td className="green">{tsh(r.view.s.payments)}</td>
                  <td className="orange"><b>{tsh(r.view.s.ending_debt)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><b>Total</b></td>
                <td className="blue"><b>{tsh(total)}</b></td>
                <td className="green"><b>{tsh(paid)}</b></td>
                <td className="orange"><b>{tsh(pending)}</b></td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <section className="dm-list">
        {loading && <p className="dm-empty">Loading…</p>}
        {!loading && visible.length === 0 && (
          <p className="dm-empty">
            {fWeek === "ALL" ? "No debts to show" : `No debt records for week ${fWeek}`}
          </p>
        )}
        {visible.map((r) => {
          const id = r.vehicle.id;
          const info = driverInfo(r.vehicle);
          const s = r.view.s; // numbers for the selected week (or the whole month)

          // The limit is monthly and counts NEW debt added this month only.
          // Debt carried over from earlier months is not counted against it.
          // It always uses the whole-month numbers, even when a week is selected.
          const limit = limitOf(r.vehicle);
          const hasLimit = limit !== null && limit > 0;
          const monthAdded = r.month.debt_added;
          const over = hasLimit && monthAdded > limit!;
          const limitPct = hasLimit ? (monthAdded / limit!) * 100 : 0;
          const remaining = hasLimit ? limit! - monthAdded : 0;
          const remainingPct = hasLimit ? Math.max(0, (remaining / limit!) * 100) : 0;

          // Total debt = what was owed at the start + new debt. Balance = total - paid - closed.
          const due = s.starting_debt + s.debt_added;
          const paidPct = due > 0 ? (s.payments / due) * 100 : 0;
          const balancePct = due > 0 ? (s.ending_debt / due) * 100 : 0;
          const isPending = s.ending_debt > 0;
          const isOpen = openId === id;
          const isManage = manageId === id;
          const tone = isPending ? "red" : "green";

          const statusClass = !hasLimit ? "none" : over ? "over" : "safe";
          const statusLabel = !hasLimit ? "NO LIMIT" : over ? "OVER LIMIT" : "SAFE";
          const statusMsg = !hasLimit
            ? "No monthly limit set yet."
            : over
              ? `New debt this month is over the limit by ${tsh(monthAdded - limit!)}.`
              : `Still safe. ${tsh(remaining)} of new debt allowed before the limit.`;

          // What was due splits into: paid, closed without payment, still owed.
          const parts: Part[] = [
            { label: "Paid", value: s.payments, color: "#16a34a" },
            ...(s.closed_debt > 0 ? [{ label: "Closed", value: s.closed_debt, color: "#9ca3af" }] : []),
            { label: "Balance", value: s.ending_debt, color: "#dc2626" },
          ];

          return (
            <article key={id} className="dm-card">
              <div className="dm-card-main">
                <div className="dm-card-top">
                  <div className="dm-who">
                    <DriverAvatar info={info} />
                    <div>
                      <h4>{r.vehicle.name}</h4>
                      {info && (
                        <p className="dm-driver">
                          {info.name}
                          {info.phone && <span> · {info.phone}</span>}
                        </p>
                      )}
                      <span className="dm-type">{r.vehicle.vehicle_type}</span>
                    </div>
                  </div>
                  <div className="dm-amount-col">
                    <span className={`dm-pill ${isPending ? "pending" : "paid"}`}>
                      {isPending ? "PENDING" : "PAID"}
                    </span>
                    <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>Balance</span>
                    <b className={tone}>{tsh(s.ending_debt)}</b>
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
                            ? tsh(monthAdded - limit!)
                            : `${tsh(remaining)} (${Math.round(remainingPct)}%)`
                          : "-"}
                      </b>
                    </div>
                  </div>
                  <div className="dm-donut-wrap">
                    <Donut parts={parts} centre={`${Math.round(paidPct)}%`} />
                    <ul className="dm-legend">
                      <li>
                        <i style={{ background: "transparent" }} />
                        <span>Total debt</span>
                        <b>{tsh(due)}</b>
                      </li>
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

                {/* The sum, written out, so every number on the card can be checked */}
                <p className="dm-limit-msg">
                  Before {tsh(s.starting_debt)} + New {tsh(s.debt_added)} − Paid {tsh(s.payments)}
                  {s.closed_debt > 0 ? ` − Closed ${tsh(s.closed_debt)}` : ""} = Balance {tsh(s.ending_debt)}
                </p>

                <div className="dm-limit-row">
                  <span className={`dm-status ${statusClass}`}>{statusLabel}</span>
                </div>
                <p className="dm-limit-msg">{statusMsg}</p>

                {/* First bar: the actual debt still owed, out of everything that was due */}
                <div className="dm-bar-block">
                  <div className="dm-bar-labels">
                    <span>Debt balance</span>
                    <span className={`${tone} dm-due`}>
                      {tsh(s.ending_debt)} · {Math.round(balancePct)}% of debt left
                    </span>
                  </div>
                  <div className="dm-bar">
                    <span className="limit-over" style={{ width: `${Math.min(100, balancePct)}%` }} />
                  </div>
                </div>

                <div className="dm-bar-block">
                  <div className="dm-bar-labels">
                    <span>Debt payment</span>
                    <span className={`${tone} dm-due`}>
                      {tsh(s.payments)} · {Math.round(paidPct)}% paid · {isPending ? "Ongoing" : "Cleared"}
                    </span>
                  </div>
                  <div className="dm-bar">
                    <span className="green" style={{ width: `${Math.min(100, paidPct)}%` }} />
                  </div>
                </div>

                {hasLimit && (
                  <div className="dm-bar-block">
                    <div className="dm-bar-labels">
                      <span>New debt vs monthly limit</span>
                      <span>{tsh(monthAdded)} · {Math.round(limitPct)}% of limit</span>
                    </div>
                    <div className="dm-bar">
                      <span
                        className={over ? "limit-over" : "limit-safe"}
                        style={{ width: `${Math.min(100, limitPct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="dm-card-actions">
                <button className="dm-btn dark" onClick={() => openForm("payment", id)}>
                  Record Payment
                </button>
                <button className="dm-btn" onClick={() => setOpenId(isOpen ? null : id)}>
                  {isOpen ? "Hide Details" : "View Details"}
                </button>
                <button className="dm-btn" onClick={() => toggleManage(id)}>
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
                            ? tsh(monthAdded - limit!)
                            : `${tsh(remaining)} (${Math.round(remainingPct)}%)`
                          : "-"}
                      </b>
                    </div>
                  </div>

                  {canEditLimit && (
                    <form
                      className="dm-limit-form"
                      onSubmit={(e: FormEvent) => { e.preventDefault(); saveLimit(r.vehicle); }}
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

              {/* The record always covers the whole month, all weeks, with a month total */}
              {isOpen && (
                <DetailTable
                  entries={r.entries}
                  s={r.month}
                  onDownload={() => downloadVehicle(r)}
                />
              )}
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
          <button className="dm-qa orange" onClick={downloadAll}>
            <img src={iconTarget} alt="" />
            <span className="dm-qa-title">Download Record</span>
            <span className="dm-qa-sub">Month debt (CSV)</span>
          </button>
          <button className="dm-qa purple" onClick={() => onNavigate?.("users")}>
            <img src={iconProfit} alt="" />
            <span className="dm-qa-title">Manage Drivers</span>
            <span className="dm-qa-sub">Drivers &amp; Debts</span>
          </button>
        </div>
      </section>

      <footer className="dm-footer">
        <span className="dm-brand">AdyBajaj <em>Your Business Partner</em></span>
        <span className="dm-tagline">Keep Your Debts Under Control!</span>
      </footer>
    </div>
  );
}
