import { useState, type FormEvent } from "react";
import { login, registerOwner } from "./api";

// Simple three-wheeler (bajaj) silhouette used as the login background.
const BAJAJ_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='300' viewBox='0 0 480 300'>
<g fill='white' fill-opacity='0.13'>
<path d='M80 205 Q80 130 160 118 L300 118 Q350 118 372 165 L392 205 Z'/>
<path d='M130 118 Q150 70 230 70 L292 118 Z'/>
<rect x='52' y='190' width='44' height='12' rx='6'/>
<circle cx='132' cy='238' r='34'/><circle cx='370' cy='238' r='28'/>
<rect x='236' y='160' width='30' height='10' rx='5'/>
</g></svg>`;
const BG = `url("data:image/svg+xml,${encodeURIComponent(BAJAJ_SVG)}")`;

export default function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [rPassword, setRPassword] = useState("");
  const [rConfirm, setRConfirm] = useState("");

  async function doLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await login(username.trim(), password); onDone(); }
    catch { setError("Email au nenosiri si sahihi."); }
    finally { setBusy(false); }
  }

  async function doRegister(e: FormEvent) {
    e.preventDefault();
    if (rPassword !== rConfirm) { setError("Nenosiri mbili hazifanani."); return; }
    setBusy(true); setError("");
    try {
      await registerOwner({ full_name: fullName.trim(), business_name: business.trim(), phone: phone.trim(), email: email.trim(), password: rPassword });
      onDone();
    } catch (err) { setError((err as Error).message || "Usajili haukukamilika."); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-page" style={{ backgroundImage: BG }}>
      <div className="auth-hero">
        <div className="auth-logo">AB</div>
        <h1>Karibu AdyBajaj</h1>
        <p>Simamia magari yako, mapato, madeni, matengenezo na timu yako kwa sehemu moja.</p>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError(""); }}>Ingia</button>
          <button className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setError(""); }}>Jisajili</button>
        </div>

        {mode === "login" ? (
          <form onSubmit={doLogin} className="auth-form">
            <label>Email au jina la mtumiaji
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </label>
            <label>Nenosiri
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "Inaingia..." : "Ingia"}</button>
            <p className="auth-switch">Huna akaunti? <button type="button" className="link" onClick={() => setMode("register")}>Bonyeza hapa kujisajili</button></p>
          </form>
        ) : (
          <form onSubmit={doRegister} className="auth-form">
            <p className="auth-note">Jisajili kama mmiliki. Utakuwa Owner wa biashara yako, na unaweza kuongeza magari, mameneja na madereva.</p>
            <label>Jina kamili *<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
            <label>Jina la biashara *<input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="mfano: Ady Bajaj Transport" required /></label>
            <label>Namba ya simu *<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required /></label>
            <label>Email *<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label>Nenosiri * (herufi 6 au zaidi)<input type="password" value={rPassword} onChange={(e) => setRPassword(e.target.value)} minLength={6} autoComplete="new-password" required /></label>
            <label>Thibitisha nenosiri *<input type="password" value={rConfirm} onChange={(e) => setRConfirm(e.target.value)} minLength={6} autoComplete="new-password" required /></label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "Inasajili..." : "Tengeneza Akaunti"}</button>
            <p className="auth-switch">Una akaunti? <button type="button" className="link" onClick={() => setMode("login")}>Ingia hapa</button></p>
          </form>
        )}
      </div>
    </div>
  );
}
