import { useEffect, useState, type FormEvent } from "react";
import { createChallenge, listChallenges, solveChallenge, type Challenge } from "./api";
import type { Role } from "./roles";
import type { Vehicle } from "./types";

// Driver reports challenges for his vehicle. Owner reports too. Manager only sees them and marks them solved.
export default function ChallengesPage({ vehicles, role }: { vehicles: Vehicle[]; role: Role }) {
  const [items, setItems] = useState<Challenge[]>([]);
  const [status, setStatus] = useState("ALL");
  const [vehicle, setVehicle] = useState("ALL");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [cVehicle, setCVehicle] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const canReport = role !== "manager";
  const canSolve = role === "owner" || role === "manager";

  async function load() {
    try { setItems(await listChallenges(status, vehicle)); setError(""); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status, vehicle]);
  useEffect(() => { if (!cVehicle && vehicles.length) setCVehicle(String(vehicles[0].id)); }, [vehicles.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await createChallenge(Number(cVehicle), title.trim(), desc.trim());
      setNotice("Changamoto imetumwa.");
      setTitle(""); setDesc("");
      load();
    } catch (err) { setError((err as Error).message); }
  }

  async function solve(c: Challenge) {
    try { await solveChallenge(c.id); setNotice("Changamoto imetatuliwa."); load(); }
    catch (err) { setError((err as Error).message); }
  }

  const when = (s: string) => new Date(s).toLocaleDateString("sw-TZ", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {canReport && (
        <section className="card form-card">
          <form onSubmit={submit}>
            <h3>Ripoti Changamoto</h3>
            <label>Gari
              <select value={cVehicle} onChange={(e) => setCVehicle(e.target.value)} required>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label>Kichwa cha tatizo<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mfano: breki mbovu" required maxLength={120} /></label>
            <label>Maelezo<input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Eleza zaidi" /></label>
            <button type="submit" disabled={!cVehicle}>Tuma Changamoto</button>
          </form>
        </section>
      )}

      <section className="card">
        <div className="filter-row">
          <label>Hali
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">Zote</option>
              <option value="open">Zinazosubiri</option>
              <option value="resolved">Zilizotatuliwa</option>
            </select>
          </label>
          <label>Gari
            <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
              <option value="ALL">Magari yote</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Changamoto</h3>
        {items.length === 0 && <p className="empty">Hakuna changamoto zilizopatikana</p>}
        <ul className="ch-list">
          {items.map((c) => (
            <li key={c.id} className={"ch-item " + c.status}>
              <div className="ch-top">
                <b>{c.title}</b>
                <span className={"ch-badge " + c.status}>{c.status === "resolved" ? "Resolved" : "Open"}</span>
              </div>
              {c.description && <p className="ch-desc">{c.description}</p>}
              <p className="ch-meta">{c.vehicle_name} · {c.created_by_name || "—"} · {when(c.created_at)}
                {c.resolved_at && ` · imetatuliwa ${when(c.resolved_at)}`}</p>
              {canSolve && c.status === "open" && (
                <button className="solve-btn" onClick={() => solve(c)}>Tatua</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
