import { useState } from "react";
import Dashboard from "./Dashboard";
import Login from "./Login";
import { clearToken, getToken } from "./api";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getToken() !== null);
  if (!loggedIn) return <Login onDone={() => setLoggedIn(true)} />;
  return <Dashboard onLogout={() => { clearToken(); setLoggedIn(false); }} />;
}
