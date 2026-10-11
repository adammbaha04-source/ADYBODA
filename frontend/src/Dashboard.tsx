import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createReturn, deleteReturn, deleteVehicle, getDebt, listReturns, listVehicles, setCarry } from "./api";
import { currentMonth, tsh } from "./format";
import Manage from "./Manage";
import type { DebtResponse, DebtSummary, ReturnRecord, Vehicle } from "./types";

type View = "vehicles" | "income" | "service" | "debt" | "changamoto" | "ripoti" | "grafu" | "users" | "profile" | "settings" | "manage";

// Same order as the old app's menu. Usimamizi (our vehicle setup screen) is kept at the end.
const MENU: { key: View; label: string; icon: string; note: string }[] = [
  { key: "vehicles", label: "Vehicles", icon: "🚗", note: "" },
  { key: "income", label: "Mapato", icon: "💵", note: "" },
  { key: "service", label: "Service", icon: "🔧", note: "Huduma za gari, matairi na bima" },
  { key: "debt", label: "Deni", icon: "📉", note: "" },
  { key: "changamoto", label: "Changamoto", icon: "⚠️", note: "Changamoto za magari" },
  { key: "ripoti", label: "Ripoti", icon: "📊", note: "Ripoti za mwezi, robo mwaka na mwaka" },
  { key: "grafu", label: "Grafu", icon: "📈", note: "Grafu za mapato na deni" },
  { key: "users", label: "Users", icon: "👥", note: "Watumiaji: owner, manager, driver" },
  { key: "profile", label: "Profile", icon: "👤", note: "Wasifu wako" },
  { key: "settings", label: "Settings", icon: "⚙️", note: "Mipangilio ya app" },
  { key: "manage", label: "Usimamizi", icon: "🛠️", note: "" },
];
const MONTHS_SW = ["Januari", "Februari", "Machi", "Aprili", "Mei", "Juni", "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_SW[m - 1]} ${y}`;
}

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="row-line">
      <span>{label}</span>
      <b className={cls}>{value}</b>
    </div>
  );
}

function VehicleCard(props: {
  vehicle: Vehicle; month: string; tick: number; selected: boolean;
  onPick: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { vehicle, month, tick, selected, onPick, onEdit, onDelete } = props;
  const [s, setS] = useState<DebtSummary | null>(null);

  useEffect(() => {
    let alive = true;
    getDebt(vehicle.id, month).then((d) => { if (alive) setS(d.summary); }).catch(() => {});
    return () => { alive = false; };
  }, [vehicle.id, month, tick]);

  const latest = [...vehicle.driver_periods].sort((a, b) => a.from_date.localeCompare(b.from_date)).pop();
  const driverText = latest && latest.driver_name
    ? `Driver: ${latest.driver_name}${latest.phone ? " • " + latest.phone : ""}`
    : "Hakuna dereva";

  // Monthly target = weekly target x 4 weeks (approximation shown on the card)
  const monthTarget = s ? s.weekly_target * 4 : 0;

  return (
    <article className={"vcard" + (selected ? " selected" : "")} onClick={onPick}>
      <div className="vhead">
        <div className="vtitle">
          <h3>{vehicle.name}</h3>
          <span className="badge type">{vehicle.vehicle_type.toUpperCase()}</span>
          <span className="badge month">{monthLabel(month)}</span>
        </div>
        <div className="vactions">
          <button className="icon" aria-label="Hariri" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✏️</button>
          <button className="icon" aria-label="Futa" onClick={(e) => { e.stopPropagation(); onDelete(); }}>🗑️</button>
        </div>
      </div>
      <p className="driver">{driverText}</p>
      {s ? (
        <>
          <div className="block">
            <div className="block-title">MONTH</div>
            <Row label="Target:" value={tsh(monthTarget)} cls="blue" />
            <Row label="Paid:" value={tsh(s.payments)} cls="green" />
          </div>
          <Row label="Month Debt:" value={tsh(s.debt_added)} cls="orange" />
          <Row label="Carry Over Debt:" value={tsh(s.starting_debt)} cls="orange" />
          <div className="total"><span>Total Debt:</span><b>{tsh(s.ending_debt)}</b></div>
        </>
      ) : (
        <p className="driver">Inapakia...</p>
      )}
    </article>
  );
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<View>("vehicles");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [debt, setDebt] = useState<DebtResponse | null>(null);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [error, setError] = useState("");

  const [day, setDay] = useState(`${currentMonth()}-01`);
  const [amount, setAmount] = useState("");
  const [excess, setExcess] = useState(false);

  const loadVehicles = useCallback(() => {
    listVehicles()
      .then((v) => { setVehicles(v); setVehicleId((cur) => cur ?? (v.length ? v[0].id : null)); })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const refresh = useCallback(async () => {
    setTick((t) => t + 1);
    if (vehicleId === null) return;
    try {
      const [d, r] = await Promise.all([getDebt(vehicleId, month), listReturns(vehicleId)]);
      setDebt(d);
      setReturns(r.filter((x) => x.day.startsWith(month)).sort((a, b) => b.day.localeCompare(a.day)));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [vehicleId, month]);

  useEffect(() => { refresh(); }, [refresh]);

  function go(v: View) {
    setView(v);
    setMenuOpen(false);
  }

  async function addReturn(e: FormEvent) {
    e.preventDefault();
    if (vehicleId === null || !amount) return;
    try {
      await createReturn(vehicleId, day, Number(amount), excess);
      setAmount("");
      setExcess(false);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleCarry(on: boolean) {
    if (vehicleId === null) return;
    await setCarry(vehicleId, month, on);
    refresh();
  }

  async function removeReturn(id: number) {
    if (!confirm("Futa mapato haya?")) return;
    await deleteReturn(id);
    refresh();
  }

  async function removeVehicle(v: Vehicle) {
    if (!confirm(`Futa gari ${v.name}? Historia yake yote itafutwa.`)) return;
    try {
      await deleteVehicle(v.id);
      if (vehicleId === v.id) setVehicleId(null);
      loadVehicles();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const s = debt?.summary;
  const hasVehicle = vehicleId !== null;

  return (
    <div className="app">
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={"drawer" + (menuOpen ? " open" : "")}>
        <div className="drawer-head">
          <div className="avatar">A</div>
          <div>
            <div className="dname">AdyBajaj</div>
            <div className="drole">OWNER</div>
          </div>
        </div>
        <nav>
          {MENU.map((m) => (
            <button key={m.key} className={"item" + (view === m.key ? " active" : "")} onClick={() => go(m.key)}>
              <span className="ico">{m.icon}</span>{m.label}
            </button>
          ))}
        </nav>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </aside>

      <header className="appbar">
        <button className="hamburger" aria-label="Menyu" onClick={() => setMenuOpen(true)}>☰</button>
        <div className="app-title">{MENU.find((m) => m.key === view)?.label}</div>
        <div className="avatar small">A</div>
      </header>

      <div className="wrap">
        {error && <p className="error">{error}</p>}

        <section className="card period">
          <div className="seg">
            <button className="seg-btn active">Mwezi</button>
            <button className="seg-btn" disabled title="Inakuja">Wiki</button>
            <button className="seg-btn" disabled title="Inakuja">Siku</button>
          </div>
          <label>Mwezi:
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          {view !== "vehicles" && vehicles.length > 0 && (
            <label>Gari:
              <select value={vehicleId ?? ""} onChange={(e) => setVehicleId(Number(e.target.value))}>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          )}
        </section>

        {view === "vehicles" && (
          <>
            <button className="btn-add" onClick={() => go("manage")}>+ Add Vehicle</button>
            {vehicles.length === 0 && <p className="card">Hakuna gari bado. Bonyeza + Add Vehicle.</p>}
            {vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                month={month}
                tick={tick}
                selected={v.id === vehicleId}
                onPick={() => { setVehicleId(v.id); go("debt"); }}
                onEdit={() => { setVehicleId(v.id); go("manage"); }}
                onDelete={() => removeVehicle(v)}
              />
            ))}
          </>
        )}

        {view === "debt" && hasVehicle && s && debt && (
          <>
            <section className="grid">
              <div className="card"><h4>Deni la mwanzo</h4><b>{tsh(s.starting_debt)}</b></div>
              <div className="card"><h4>Deni jipya</h4><b className="red">{tsh(s.debt_added)}</b></div>
              <div className="card"><h4>Malipo</h4><b className="green">{tsh(s.payments)}</b></div>
              <div className="card"><h4>Deni la mwisho</h4><b className="red">{tsh(s.ending_debt)}</b></div>
              <div className="card"><h4>Target ya wiki</h4><b>{tsh(s.weekly_target)}</b></div>
            </section>
            <label className="card toggle">
              <input type="checkbox" checked={s.carry_over_on} onChange={(e) => toggleCarry(e.target.checked)} />
              Deni la mwezi huu lipelekwe mwezi unaofuata (Carry over)
            </label>
            <section className="card">
              <h3>Historia ya deni</h3>
              <div className="scroll">
                <table>
                  <thead>
                    <tr><th>Tarehe</th><th>Aina</th><th>Awali</th><th>Mpya</th><th>Imelipwa</th><th>Imefungwa</th><th>Baada</th><th>Maelezo</th></tr>
                  </thead>
                  <tbody>
                    {debt.entries.length === 0 && <tr><td colSpan={8}>Hakuna historia kwa mwezi huu</td></tr>}
                    {debt.entries.map((e) => (
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
          </>
        )}

        {view === "income" && hasVehicle && (
          <section className="card">
            <h3>Ongeza mapato</h3>
            <form className="row wrap-row" onSubmit={addReturn}>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
              <input type="number" inputMode="numeric" placeholder="Kiasi" value={amount} onChange={(e) => setAmount(e.target.value)} required min={0} />
              <label className="inline"><input type="checkbox" checked={excess} onChange={(e) => setExcess(e.target.checked)} /> Ziada</label>
              <button type="submit">Hifadhi</button>
            </form>
            <ul className="list">
              {returns.length === 0 && <li>Hakuna mapato kwa mwezi huu</li>}
              {returns.map((r) => (
                <li key={r.id}>
                  <span>{r.day} {r.is_excess && "(ziada)"}</span>
                  <b>{tsh(r.amount)}</b>
                  <button className="danger" onClick={() => removeReturn(r.id)}>Futa</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {view === "manage" && (
          <Manage vehicleId={vehicleId} onChanged={refresh} onVehicleCreated={loadVehicles} />
        )}

        {MENU.find((m) => m.key === view && m.note) && (
          <section className="card placeholder">
            <h3>{MENU.find((m) => m.key === view)?.label}</h3>
            <p>{MENU.find((m) => m.key === view)?.note}</p>
            <p className="soon-note">Sehemu hii inajengwa. Itaonekana na kufanya kazi kama app ya zamani katika hatua inayofuata.</p>
          </section>
        )}

        {(view === "debt" || view === "income") && !hasVehicle && (
          <p className="card">Ongeza gari kwanza kwenye Usimamizi.</p>
        )}
      </div>
    </div>
  );
}
