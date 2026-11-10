import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError, isNetworkError, login, registerOwner } from "./api";
import "./login.css";

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
const ArrowRight = () => (
  <Icon>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
const TabUsers = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
    <circle cx="17" cy="9" r="2.8" />
    <path d="M16 14.2c3.2 0 5.5 1.6 5.5 4.8" />
  </Icon>
);
const TabChart = () => (
  <Icon>
    <path d="M4 20V11M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);
const PersonIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
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
      <span className="lg-input">
        <LockIcon />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          aria-label={label}
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

// Chagua ujumbe sahihi kulingana na aina ya kosa, badala ya kudhani nenosiri ni baya kila mara.
function loginErrorMessage(err: unknown): string {
  if (isNetworkError(err)) return (err as Error).message;
  if (err instanceof ApiError && err.status >= 500) {
    return "Seva haipatikani kwa sasa. Jaribu tena baada ya dakika chache.";
  }
  return "Email au nenosiri si sahihi.";
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
    catch (err) { setError(loginErrorMessage(err)); }
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
    <div className="lg-page">
      {/* Header: logo, name, tagline and bajaji photo are part of the header image. */}
      <header className="lg-hero">
        <h1 className="sr-only">AdyBajaj</h1>
        <p className="sr-only">Simamia magari yako, mapato, madeni, matengenezo na timu yako kwa sehemu moja.</p>
      </header>

      <main className="lg-card">
        <span className="lg-avatar" aria-hidden="true"><PersonIcon /></span>

        <h2 className="lg-title">{mode === "login" ? "Karibu AdyBajaj" : "Tengeneza akaunti"}</h2>
        <p className="lg-sub">
          {mode === "login"
            ? "Ingia kwenye akaunti yako ili kuendelea"
            : "Jisajili kama mmiliki wa biashara"}
        </p>

        <div className="lg-tabs" role="tablist">
          <button
            type="button" role="tab" aria-selected={mode === "login"}
            className={mode === "login" ? "on" : ""} onClick={() => switchMode("login")}
          >
            <TabUsers />
            <span>Ingia</span>
          </button>
          <button
            type="button" role="tab" aria-selected={mode === "register"}
            className={mode === "register" ? "on" : ""} onClick={() => switchMode("register")}
          >
            <TabChart />
            <span>Jisajili</span>
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={doLogin} className="lg-form">
            <label className="lg-field">
              <span className="lg-input">
                <MailIcon />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Email au jina la mtumiaji"
                  aria-label="Email au jina la mtumiaji"
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
              <span>{busy ? "Inaingia..." : "Ingia"}</span>
              {!busy && <ArrowRight />}
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
              <span className="lg-input">
                <UserIcon />
                <input
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jina kamili" aria-label="Jina kamili" autoComplete="name" required
                />
              </span>
            </label>

            <label className="lg-field">
              <span className="lg-input">
                <input
                  value={business} onChange={(e) => setBusiness(e.target.value)}
                  placeholder="Jina la biashara (mfano: Ady Bajaj Transport)"
                  aria-label="Jina la biashara" required
                />
              </span>
            </label>

            <label className="lg-field">
              <span className="lg-input">
                <input
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="Namba ya simu" aria-label="Namba ya simu"
                  inputMode="tel" autoComplete="tel" required
                />
              </span>
            </label>

            <label className="lg-field">
              <span className="lg-input">
                <MailIcon />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email" aria-label="Email"
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
              <span>{busy ? "Inasajili..." : "Tengeneza Akaunti"}</span>
              {!busy && <ArrowRight />}
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

      {/* Footer: feature icons and closing line are part of the footer image. */}
      <footer className="lg-footer">
        <h2 className="sr-only">Ripoti za mapato, usalama wa juu, usimamizi wa timu, msaada mara moja</h2>
      </footer>
    </div>
  );
}
