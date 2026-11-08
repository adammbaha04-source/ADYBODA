import { useCallback, useEffect, useRef, useState } from "react";
import Dashboard from "./Dashboard";
import Login from "./Login";
import { clearToken, getToken } from "./api";

// Muda wa kutoka yenyewe bila kutumia app (dakika 15)
const IDLE_MS = 15 * 60 * 1000;

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getToken() !== null);
  const lastActive = useRef(Date.now());

  const logout = useCallback(() => {
    clearToken();
    setLoggedIn(false);
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    lastActive.current = Date.now();

    const touch = () => { lastActive.current = Date.now(); };
    const check = () => {
      if (Date.now() - lastActive.current > IDLE_MS) logout();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    const events = ["click", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, 30000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [loggedIn, logout]);

  if (!loggedIn) return <Login onDone={() => setLoggedIn(true)} />;
  return <Dashboard onLogout={logout} />;
}
