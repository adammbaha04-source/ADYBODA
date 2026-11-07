import { useState, type FormEvent, type ReactNode } from "react";
import { login, registerOwner } from "./api";
import "./login.css";

// Simple three-wheeler (bajaj) silhouette used as the subtle background.
const BAJAJ_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='300' viewBox='0 0 480 300'>
<g fill='white' fill-opacity='0.08'>
<path d='M80 205 Q80 130 160 118 L300 118 Q350 118 372 165 L392 205 Z'/>
<path d='M130 118 Q150 70 230 70 L292 118 Z'/>
<rect x='52' y='190' width='44' height='12' rx='6'/>
<circle cx='132' cy='238' r='34'/><circle cx='370' cy='238' r='28'/>
<rect x='236' y='160' width='30' height='10' rx='5'/>
</g></svg>`;
const BG = `url("data:image/svg+xml,${encodeURIComponent(BAJAJ_SVG)}")`;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

const MailIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Icon>
);
const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </Icon>
);
const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);
const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const EyeOffIcon = () => (
  <Icon>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
    <path d="M9.9 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.1-.9" />
  </Icon>
);

// Password field with a show/hide button. Each field keeps its own visibility state.
function PasswordInput({
  label, value, onChange, autoComplete, minLength,
}: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string; minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="lg-field">
      <span className="lg-label">{label}</span>
      <span className="lg-input">
        <LockIcon />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required
        />
        <button
          type="button"
          className="lg-eye"
          aria-label={show ? "Ficha nenosiri" : "Onyesha nenosiri"}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
    </label>
  );
}

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

  function switchMode(m: "login" | "register") {
    setMode(m);
    setError("");
  }

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
      await registerOwner({
        full_name: fullName.trim(), business_name: business.trim(), phone: phone.trim(),
        email: email.trim(), password: rPassword,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message || "Usajili haukukamilika.");
    } finally { setBusy(false); }
  }

  return (
    <div className="lg-page" style={{ backgroundImage: BG }}>
      <header className="lg-hero">
        <div className="lg-brand">
          <span className="lg-logo" aria-hidden="true">AB</span>
          <span className="lg-word">Ady<i>Bajaj</i></span>
        </div>
        <p className="lg-tag">Simamia magari yako, mapato, madeni, matengenezo na timu yako kwa sehemu moja.</p>
      </header>

      <main className="lg-card">
        <h1>{mode === "login" ? "Karibu AdyBajaj" : "Tengeneza akaunti"}</h1>
        <p className="lg-sub">
          {mode === "login" ? "Ingia kwenye akaunti yako" : "Jisajili kama mmiliki wa biashara"}
        </p>

        <div className="lg-tabs" role="tablist">
          <button
            type="button" role="tab" aria-selected={mode === "login"}
            className={mode === "login" ? "on" : ""} onClick={() => switchMode("login")}
          >
            Ingia
          </button>
          <button
            type="button" role="tab" aria-selected={mode === "register"}
            className={mode === "register" ? "on" : ""} onClick={() => switchMode("register")}
          >
            Jisajili
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={doLogin} className="lg-form">
            <label className="lg-field">
              <span className="lg-label">Email au jina la mtumiaji</span>
              <span className="lg-input">
                <MailIcon />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                />
              </span>
            </label>

            <PasswordInput
              label="Nenosiri" value={password} onChange={setPassword} autoComplete="current-password"
            />

            {error && <p className="lg-error" role="alert">{error}</p>}

            <button type="submit" className="lg-submit" disabled={busy}>
              {busy ? "Inaingia..." : "Ingia"}
            </button>

            <p className="lg-switch">
              Huna akaunti?{" "}
              <button type="button" className="lg-link" onClick={() => switchMode("register")}>
                Jisajili sasa
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={doRegister} className="lg-form">
            <p className="lg-note">
              Utakuwa Owner wa biashara yako, na unaweza kuongeza magari, mameneja na madereva.
            </p>

            <label className="lg-field">
              <span className="lg-label">Jina kamili</span>
              <span className="lg-input">
                <UserIcon />
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
              </span>
            </label>

            <label className="lg-field">
              <span className="lg-label">Jina la biashara</span>
              <span className="lg-input">
                <input
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  placeholder="mfano: Ady Bajaj Transport"
                  required
                />
              </span>
            </label>

            <label className="lg-field">
              <span className="lg-label">Namba ya simu</span>
              <span className="lg-input">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required />
              </span>
            </label>

            <label className="lg-field">
              <span className="lg-label">Email</span>
              <span className="lg-input">
                <MailIcon />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email" autoCapitalize="none" required
                />
              </span>
            </label>

            <PasswordInput
              label="Nenosiri (herufi 6 au zaidi)" value={rPassword} onChange={setRPassword}
              autoComplete="new-password" minLength={6}
            />
            <PasswordInput
              label="Thibitisha nenosiri" value={rConfirm} onChange={setRConfirm}
              autoComplete="new-password" minLength={6}
            />

            {error && <p className="lg-error" role="alert">{error}</p>}

            <button type="submit" className="lg-submit" disabled={busy}>
              {busy ? "Inasajili..." : "Tengeneza Akaunti"}
            </button>

            <p className="lg-switch">
              Una akaunti?{" "}
              <button type="button" className="lg-link" onClick={() => switchMode("login")}>
                Ingia hapa
              </button>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
