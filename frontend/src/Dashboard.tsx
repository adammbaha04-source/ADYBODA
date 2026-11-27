import { useCallback, useEffect, useState } from "react";
import { deleteVehicle, getMe, listVehicles, type MeProfile } from "./api";
import { currentMonth } from "./format";
import { applyAppearance } from "./theme";
import { asRole, canOpen, menuFor, ROLE_NAME, type View } from "./roles";
import VehicleDetail from "./VehicleDetail";
import VehiclesPage, { type PeriodSel } from "./VehiclesPage";
import ExpensesPage from "./ExpensesPage";
import ServicePage from "./ServicePage";
import DebtPage from "./DebtPage";
import ChallengesPage from "./ChallengesPage";
import ReportsPage from "./ReportsPage";
import UsersPage from "./UsersPage";
import ProfilePage from "./ProfilePage";
import SettingsPage from "./SettingsPage";
import Analytics from "./Analytics"; // <-- IMPORT MPYA YA ANALYTICS
import AIChatPage from "./AIChatPage"; // <-- ChartBot kwenye menyu
import PeriodBar from "./PeriodBar"; // <-- upau MMOJA wa mwezi/wiki
import "./appbar.css"; // <-- muonekano mpya wa upau wa juu (menyu + picha)
import type { Vehicle } from "./types";

// Pages that do not use the month/period bar.
const NO_PERIOD: View[] = ["profile", "settings", "changamoto", "users", "chatbot"];
// Pages that also use the week choice (Mwezi / Wiki).
const WEEK_VIEWS: View[] = ["vehicles", "debt"];

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<View>("vehicles");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const [me, setMe] = useState<MeProfile | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState<"month" | "week">("month");
  const [week, setWeek] = useState(1);

  const role = asRole(me?.role);
  // Until the profile is loaded we show no menu items, so nobody sees the wrong menu for a moment.
  const menu = me ? menuFor(role) : [];
  const canManageVehicles = role === "owner";

  const detail = vehicles.find((v) => v.id === detailId) ?? null;

  const loadVehicles = useCallback(() => {
    listVehicles()
      .then((v) => { setVehicles(v); setVehicleId((cur) => cur ?? (v.length ? v[0].id : null)); })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  // Apply the user's saved appearance and learn the role as soon as the app opens.
  useEffect(() => {
    getMe().then((p) => { setMe(p); applyAppearance(p); }).catch(() => { /* keep defaults if offline */ });
  }, []);

  // If the open page is not allowed for this role, go back to Vehicles.
  useEffect(() => {
    if (me && !canOpen(role, view)) setView("vehicles");
  }, [me, role, view]);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  function go(v: View) {
    setView(v);
    setMenuOpen(false);
    setAvatarOpen(false);
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

  const hasWeek5 = vehicles.some((v) => v.include_week5);
  const weeks = hasWeek5 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
  const period: PeriodSel = { mode: periodMode, week };
  const initial = (me?.full_name || me?.username || "A").charAt(0).toUpperCase();
  const avatarSrc = me?.avatar || "";
  const drawerName = me?.full_name || me?.business_name || "AdyBajaj";

  const showPeriodBar = !NO_PERIOD.includes(view) && !(view === "vehicles" && detail);

  function logout() {
    onLogout();
  }

  return (
    <div className="app">
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={"drawer" + (menuOpen ? " open" : "")}>
        <div className="drawer-head">
          <div className="avatar">A</div>
          <div>
            <div className="dname">{drawerName}</div>
            <div className="drole">{ROLE_NAME[role]}</div>
          </div>
        </div>
        <nav>
          {menu.map((m) => (
            <button key={m.key} className={"item" + (view === m.key ? " active" : "")} onClick={() => go(m.key)}>
              <span className="ico">{m.icon}</span>{m.label}
            </button>
          ))}
        </nav>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </aside>

      <header className="ab">
        <button type="button" className="ab-menu" aria-label="Menyu" onClick={() => setMenuOpen(true)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </svg>
        </button>
        <div className="ab-title">{menu.find((m) => m.key === view)?.label ?? ""}</div>
        <div className="ab-user">
          <button type="button" className="ab-avatar" aria-label="Akaunti yangu" onClick={() => setAvatarOpen((v) => !v)}>
            {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{initial}</span>}
          </button>
          {avatarOpen && (
            <div className="avatar-menu">
              <div className="am-name">{me?.full_name || me?.username || "Mtumiaji"}</div>
              <div className="am-mail">{me?.email || me?.username}</div>
              <span className="am-role">{ROLE_NAME[role]}</span>
              <button className="am-item" onClick={() => go("profile")}>👤 My Profile</button>
              <button className="am-item red" onClick={logout}>🚪 Logout</button>
            </div>
          )}
        </div>
      </header>

      <div className="wrap">
        {error && <p className="error">{error}</p>}

        {/* Upau MMOJA wa mwezi kwa kurasa zote. Wiki inaonekana kwenye Vehicles na Deni tu. */}
        {showPeriodBar && (
          <PeriodBar
            month={month}
            onMonth={setMonth}
            showWeek={WEEK_VIEWS.includes(view)}
            mode={periodMode}
            onMode={setPeriodMode}
            week={week}
            weeks={weeks}
            onWeek={setWeek}
          />
        )}

        {view === "vehicles" && detail && (
          <VehicleDetail
            vehicle={detail}
            allVehicles={vehicles}
            role={role}
            month={month}
            onBack={() => setDetailId(null)}
            onMonthChange={setMonth}
            onChanged={() => { loadVehicles(); bump(); }}
            onDeleted={() => { setDetailId(null); loadVehicles(); bump(); }}
          />
        )}
        {view === "vehicles" && !detail && (
          <VehiclesPage
            vehicles={vehicles}
            canManage={canManageVehicles}
            month={month}
            tick={tick}
            period={period}
            onMonthChange={setMonth}
            onPeriodModeChange={setPeriodMode}
            onWeekChange={setWeek}
            onUpdated={() => { loadVehicles(); bump(); }}
            onOpen={(v) => setDetailId(v.id)}
            onDelete={(v) => removeVehicle(v)}
            onAdded={() => { loadVehicles(); bump(); }}
          />
        )}

        {view === "income" && <ExpensesPage month={month} />}
        {view === "service" && <ServicePage vehicles={vehicles} month={month} />}
        {view === "debt" && <DebtPage vehicles={vehicles} month={month} period={period} />}
        {view === "changamoto" && <ChallengesPage vehicles={vehicles} role={role} />}

        {/* HAPA NDIPO ANALYTICS INAPOINGIA BADALA YA REPORTS ZA GRAFYS */}
        {view === "grafu" && <Analytics vehicles={vehicles} month={month} />}

        {/* ChartBot: inafunguka mtu akibonyeza menyu, na kufunga kunarudi Vehicles */}
        {view === "chatbot" && <AIChatPage vehicles={vehicles} month={month} onClose={() => go("vehicles")} />}

        {view === "ripoti" && <ReportsPage vehicles={vehicles} month={month} onMonthChange={setMonth} />}
        {view === "users" && <UsersPage vehicles={vehicles} />}
        {view === "profile" && <ProfilePage onChanged={(p) => applyAppearance(p)} />}
        {view === "settings" && <SettingsPage />}
      </div>
    </div>
  );
}
