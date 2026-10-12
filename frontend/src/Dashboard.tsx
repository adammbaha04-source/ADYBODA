import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createReturn, deleteReturn, deleteVehicle, getDebt, listReturns, listVehicles, setCarry } from "./api";
import { currentMonth, monthLabel, todayYMD, tsh } from "./format";
import Manage from "./Manage";
import VehicleDetail from "./VehicleDetail";
import VehiclesPage from "./VehiclesPage";
import ExpensesPage from "./ExpensesPage";
import ServicePage from "./ServicePage";
import DebtPage from "./DebtPage";
import type { DebtResponse, ReturnRecord, Vehicle } from "./types";

type View = "vehicles" | "income" | "service" | "debt" | "changamoto" | "ripoti" | "grafu" | "users" | "profile" | "settings" | "manage";

// Same order as the old app's menu. Usimamizi (our vehicle setup screen) is kept at the end.
const MENU: { key: View; label: string; icon: string; note: string }[] = [
  { key: "vehicles", label: "Vehicles", icon: "🚗", note: "" },
  { key: "income", label: "Matumizi", icon: "💵", note: "" },
  { key: "service", label: "Service", icon: "🔧", note: "" },
  { key: "debt", label: "Deni", icon: "📉", note: "" },
  { key: "changamoto", label: "Changamoto", icon: "⚠️", note: "Changamoto za magari" },
  { key: "ripoti", label: "Ripoti", icon: "📊", note: "Ripoti za mwezi, robo mwaka na mwaka" },
  { key: "grafu", label: "Grafu", icon: "📈", note: "Grafu za mapato na deni" },
  { key: "users", label: "Users", icon: "👥", note: "Watumiaji: owner, manager, driver" },
  { key: "profile", label: "Profile", icon: "👤", note: "Wasifu wako" },
  { key: "settings", label: "Settings", icon: "⚙️", note: "Mipangilio ya app" },
  { key: "manage", label: "Usimamizi", icon: "🛠️", note: "" },
];

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<View>("vehicles");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const detail = vehicles.find((v) => v.id === detailId) ?? null;
  const [debt, setDebt] = useState<DebtResponse | null>(null);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [error, setError] = useState("");

  const [day, setDay] = useState(`${todayYMD().slice(0, 7)}-01`);
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

        {view === "vehicles" && detail && (
          <VehicleDetail
            vehicle={detail}
            month={month}
            onBack={() => setDetailId(null)}
            onChanged={() => { loadVehicles(); setTick((t) => t + 1); }}
            onDeleted={() => { setDetailId(null); loadVehicles(); setTick((t) => t + 1); }}
          />
        )}

        {view === "vehicles" && !detail && (
          <VehiclesPage
            vehicles={vehicles}
            month={month}
            tick={tick}
            onOpen={(v) => setDetailId(v.id)}
            onDelete={(v) => removeVehicle(v)}
            onAdded={() => { loadVehicles(); setTick((t) => t + 1); }}
          />
        )}

        {view === "service" && <ServicePage vehicles={vehicles} month={month} />}

        {view === "debt" && <DebtPage vehicles={vehicles} month={month} />}

        {view === "income" && <ExpensesPage month={month} />}

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
