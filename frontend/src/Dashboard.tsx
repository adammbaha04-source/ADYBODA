import { useCallback, useEffect, useState } from "react";
import { deleteVehicle, getMe, listVehicles } from "./api";
import { currentMonth } from "./format";
import { applyAppearance } from "./theme";
import Manage from "./Manage";
import VehicleDetail from "./VehicleDetail";
import VehiclesPage from "./VehiclesPage";
import ExpensesPage from "./ExpensesPage";
import ServicePage from "./ServicePage";
import DebtPage from "./DebtPage";
import ChallengesPage from "./ChallengesPage";
import ReportsPage from "./ReportsPage";
import UsersPage from "./UsersPage";
import ProfilePage from "./ProfilePage";
import SettingsPage from "./SettingsPage";
import type { Vehicle } from "./types";

type View = "vehicles" | "income" | "service" | "debt" | "changamoto" | "ripoti" | "grafu" | "users" | "profile" | "settings" | "manage";

const MENU: { key: View; label: string; icon: string }[] = [
  { key: "vehicles", label: "Vehicles", icon: "🚗" },
  { key: "income", label: "Matumizi", icon: "💵" },
  { key: "service", label: "Service", icon: "🔧" },
  { key: "debt", label: "Deni", icon: "📉" },
  { key: "changamoto", label: "Changamoto", icon: "⚠️" },
  { key: "ripoti", label: "Ripoti", icon: "📊" },
  { key: "grafu", label: "Grafu", icon: "📈" },
  { key: "users", label: "Users", icon: "👥" },
  { key: "profile", label: "Profile", icon: "👤" },
  { key: "settings", label: "Settings", icon: "⚙️" },
  { key: "manage", label: "Usimamizi", icon: "🛠️" },
];

// Pages that do not use the month/period card.
const NO_PERIOD: View[] = ["profile", "settings", "changamoto", "users"];

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<View>("vehicles");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");

  const detail = vehicles.find((v) => v.id === detailId) ?? null;

  const loadVehicles = useCallback(() => {
    listVehicles()
      .then((v) => { setVehicles(v); setVehicleId((cur) => cur ?? (v.length ? v[0].id : null)); })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  // Apply the user's saved appearance (background, dark mode, accent) as soon as the app opens.
  useEffect(() => {
    getMe().then(applyAppearance).catch(() => { /* keep defaults if offline */ });
  }, []);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  function go(v: View) {
    setView(v);
    setMenuOpen(false);
    if (v !== "vehicles") setDetailId(null);
  }

  async function removeVehicle(v: Vehicle) {
    if (!confirm(`Futa gari ${v.name}? Historia yake yote itafutwa.`)) return;
    try {
      await deleteVehicle(v.id);
      if (vehicleId === v.id) setVehicleId(null);
      if (detailId === v.id) setDetailId(null);
      loadVehicles();
      bump();
    } catch (err) {
      setError((err as Error).message);
    }
  }

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

        {!NO_PERIOD.includes(view) && (
          <section className="card period">
            <div className="seg">
              <button className="seg-btn active">Mwezi</button>
              <button className="seg-btn" disabled title="Inakuja">Wiki</button>
              <button className="seg-btn" disabled title="Inakuja">Siku</button>
            </div>
            <label>Mwezi:
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          </section>
        )}

        {view === "vehicles" && detail && (
          <VehicleDetail
            vehicle={detail}
            month={month}
            onBack={() => setDetailId(null)}
            onChanged={() => { loadVehicles(); bump(); }}
            onDeleted={() => { setDetailId(null); loadVehicles(); bump(); }}
          />
        )}
        {view === "vehicles" && !detail && (
          <VehiclesPage
            vehicles={vehicles}
            month={month}
            tick={tick}
            onOpen={(v) => setDetailId(v.id)}
            onDelete={(v) => removeVehicle(v)}
            onAdded={() => { loadVehicles(); bump(); }}
          />
        )}

        {view === "income" && <ExpensesPage month={month} />}
        {view === "service" && <ServicePage vehicles={vehicles} month={month} />}
        {view === "debt" && <DebtPage vehicles={vehicles} month={month} />}
        {view === "changamoto" && <ChallengesPage vehicles={vehicles} />}
        {view === "ripoti" && <ReportsPage mode="report" vehicles={vehicles} />}
        {view === "grafu" && <ReportsPage mode="graphs" vehicles={vehicles} />}
        {view === "users" && <UsersPage vehicles={vehicles} />}
        {view === "profile" && <ProfilePage onChanged={(p) => applyAppearance(p)} />}
        {view === "settings" && <SettingsPage />}
        {view === "manage" && (
          <Manage vehicleId={vehicleId} onChanged={bump} onVehicleCreated={() => { loadVehicles(); bump(); }} />
        )}
      </div>
    </div>
  );
}
