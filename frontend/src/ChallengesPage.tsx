import { useEffect, useState, type FormEvent } from "react";
import { createChallenge, listChallenges, solveChallenge, type Challenge } from "./api";
import type { Role } from "./roles";
import type { Vehicle } from "./types";
import "./ChallengesPage.css";

type Tab = "ALL" | "open" | "resolved";

// Driver reports challenges for his vehicle. Owner reports too. Manager only sees them and marks them solved.
export default function ChallengesPage({ vehicles, role }: { vehicles: Vehicle[]; role: Role }) {
  const [items, setItems] = useState<Challenge[]>([]);
  const [tab, setTab] = useState<Tab>("ALL");
  const [vehicle, setVehicle] = useState("ALL");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [cVehicle, setCVehicle] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [sending, setSending] = useState(false);

  const canReport = role !== "manager";
  const canSolve = role === "owner" || role === "manager";

  // Loads every challenge (for the chosen vehicle). The tabs filter them on the phone,
  // so the numbers on the tabs and the top cards are always right.
  async function load() {
    try { setItems(await listChallenges("ALL", vehicle)); setError(""); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicle]);
  useEffect(() => { if (!cVehicle && vehicles.length) setCVehicle(String(vehicles[0].id)); }, [vehicles.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      await createChallenge(Number(cVehicle), title.trim(), desc.trim());
      setNotice("Changamoto imetumwa.");
      setError("");
      setTitle(""); setDesc("");
      setShowForm(false);
      load();
    } catch (err) { setNotice(""); setError((err as Error).message); }
    finally { setSending(false); }
  }

  async function solve(c: Challenge) {
    try { await solveChallenge(c.id); setNotice("Changamoto imetatuliwa."); setError(""); load(); }
    catch (err) { setNotice(""); setError((err as Error).message); }
  }

  const day = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = (s: string) => new Date(s).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const pending = items.filter((c) => c.status === "open").length;
  const resolved = items.filter((c) => c.status === "resolved").length;
  const shown = tab === "ALL" ? items : items.filter((c) => c.status === tab);

  const tabs: { key: Tab; label: string; n: number; dot: string }[] = [
    { key: "ALL", label: "Zote", n: items.length, dot: "" },
    { key: "open", label: "Pending", n: pending, dot: "orange" },
    { key: "resolved", label: "Resolved", n: resolved, dot: "green" },
  ];

  const infoText = (c: Challenge) =>
    c.status === "resolved"
      ? `Imetatuliwa${c.resolved_at ? " · " + day(c.resolved_at) : ""}`
      : role === "driver" ? "Inachunguzwa na Manager…" : "Tunaichunguza tatizo hili…";

  return (
    <div className="cp">
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <section className="cp-stats">
        <div className="cp-stat orange">
          <span className="cp-stat-ico">!</span>
          <div><b>{String(pending).padStart(2, "0")}</b><small>Pending</small></div>
        </div>
        <div className="cp-stat green">
          <span className="cp-stat-ico">✓</span>
          <div><b>{String(resolved).padStart(2, "0")}</b><small>Resolved</small></div>
        </div>
      </section>

      {canReport && (
        <button type="button" className="cp-report" onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
          <span className="cp-report-ico">💬</span>
          <span className="cp-report-text">
            <b>Wasilisha Changamoto</b>
            <small>Ripoti tatizo lolote la gari au huduma</small>
          </span>
          <span className="cp-report-go">{showForm ? "×" : "›"}</span>
        </button>
      )}

      {canReport && showForm && (
        <form className="cp-form" onSubmit={submit}>
          <label>Gari
            <select value={cVehicle} onChange={(e) => setCVehicle(e.target.value)} required>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label>Kichwa cha tatizo
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mfano: breki mbovu" required maxLength={120} />
          </label>
          <label>Maelezo
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Eleza zaidi" />
          </label>
          <button type="submit" disabled={!cVehicle || sending}>{sending ? "Inatuma..." : "Tuma Changamoto"}</button>
        </form>
      )}

      <section className="cp-panel">
        <div className="cp-panel-head">
          <h3>{role === "driver" ? "Changamoto Zangu" : "Changamoto Zote"}</h3>
          <button type="button" className="cp-refresh" onClick={() => setTab("ALL")}>Tazama Zote →</button>
        </div>

        {vehicles.length > 1 && (
          <select className="cp-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label="Gari">
            <option value="ALL">Magari yote</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}

        <div className="cp-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? "active" : ""}
              onClick={() => setTab(t.key)}
            >
              {t.dot && <i className={t.dot} />}
              {t.label} ({t.n})
            </button>
          ))}
        </div>

        {shown.length === 0 && <p className="cp-empty">Hakuna changamoto zilizopatikana</p>}

        <ul className="cp-list">
          {shown.map((c) => {
            const isResolved = c.status === "resolved";
            const isOpen = openId === c.id;
            return (
              <li key={c.id} className="cp-item">
                <button type="button" className="cp-row" onClick={() => setOpenId(isOpen ? null : c.id)} aria-expanded={isOpen}>
                  <span className={"cp-tile " + (isResolved ? "green" : "orange")}>{isResolved ? "🔧" : "🚗"}</span>
                  <span className="cp-body">
                    <span className="cp-line">
                      <b className="cp-title">{c.title}</b>
                      <span className={"cp-pill " + (isResolved ? "green" : "yellow")}>{isResolved ? "Resolved" : "Pending"}</span>
                    </span>
                    {c.description && <span className={"cp-desc" + (isOpen ? " full" : "")}>{c.description}</span>}
                    <span className="cp-meta">
                      📅 {day(c.created_at)} · {time(c.created_at)} &nbsp;|&nbsp; 🚘 {c.vehicle_name}
                    </span>
                    {role !== "driver" && <span className="cp-meta">👤 Imewasilishwa na: {c.created_by_name || "—"}</span>}
                  </span>
                  <span className={"cp-chev" + (isOpen ? " open" : "")}>›</span>
                </button>

                <div className={"cp-info " + (isResolved ? "green" : "blue")}>
                  <span className="cp-info-ico">{isResolved ? "✓" : "i"}</span>
                  {infoText(c)}
                </div>

                {isOpen && canSolve && !isResolved && (
                  <button className="cp-solve" onClick={() => solve(c)}>Tatua</button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
