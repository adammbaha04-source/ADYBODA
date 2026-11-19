import { useCallback, useEffect, useRef, useState } from "react";
import Dashboard from "./Dashboard";
import Login from "./Login";
import { clearToken, getToken } from "./api";

// Muda wa kutoka yenyewe bila kutumia app (dakika 5)
const IDLE_MS = 5 * 60 * 1000;
const KEY = "adybajaj_last_active";

function readLast(): number {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}
function writeLast(t: number) {
  try { localStorage.setItem(KEY, String(t)); } catch { /* ignore */ }
}
function expired(): boolean {
  const last = readLast();
  return last > 0 && Date.now() - last > IDLE_MS;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => {
    if (getToken() === null) return false;
    if (expired()) { clearToken(); return false; }
    return true;
  });
  const lastWrite = useRef(0);

  const logout = useCallback(() => {
    clearToken();
    setLoggedIn(false);
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const now = Date.now();
    lastWrite.current = now;
    writeLast(now);

    const check = () => { if (expired()) logout(); };
    const touch = () => {
      const t = Date.now();
      if (t - lastWrite.current < 2000) return;
      if (expired()) { logout(); return; }
      lastWrite.current = t;
      writeLast(t);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    const events = ["click", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, 30000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
      window.clearInterval(timer);
    };
  }, [loggedIn, logout]);

  if (!loggedIn) return <Login onDone={() => setLoggedIn(true)} />;
  return <Dashboard onLogout={logout} />;
}
