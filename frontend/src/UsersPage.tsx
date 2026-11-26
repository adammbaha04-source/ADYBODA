import { useEffect, useState, type FormEvent } from "react";
import { createTeamMember, deleteTeamMember, listTeam } from "./api";
import { updateTeamMember } from "./api_extra";
import type { TeamMember, Vehicle } from "./types";
import "./UsersPage.css";

type TeamRole = "manager" | "driver";

// Fomu ya kuhariri mtumiaji mmoja (inafunguka chini ya jina lake).
function TeamEditor({
  member, vehicles, onSaved, onCancel,
}: { member: TeamMember; vehicles: Vehicle[]; onSaved: () => void; onCancel: () => void }) {
  const [username, setUsername] = useState(member.username);
  const [phone, setPhone] = useState(member.phone || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<TeamRole>(member.role as TeamRole);
  const [picked, setPicked] = useState<number[]>(member.vehicles.map((v) => v.id));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(id: number) {
    setPicked((cur) => {
      if (role === "driver") return cur.includes(id) ? [] : [id];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
  }

  function changeRole(r: TeamRole) {
    setRole(r);
    if (r === "driver") setPicked((cur) => cur.slice(0, 1));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (password && password.length < 6) { setError("Nenosiri jipya lazima liwe na herufi 6 au zaidi."); return; }
    if (role === "driver" && picked.length > 1) { setError("Dereva anapangiwa gari moja tu."); return; }
    setBusy(true); setError("");
    try {
      const body: { username: string; phone: string; role: TeamRole; vehicles: number[]; password?: string } = {
        username: username.trim(), phone: phone.trim(), role, vehicles: picked,
      };
      if (password) body.password = password;
      await updateTeamMember(member.id, body);
      onSaved();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} style={{ width: "100%" }}>
      <label>Jina la mtumiaji
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>Simu
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0712345678" />
      </label>
      <label>Nenosiri jipya (acha tupu kama halibadilishwi)
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
      </label>
      <label>Role
        <select value={role} onChange={(e) => changeRole(e.target.value as TeamRole)}>
          <option value="manager">Manager</option>
          <option value="driver">Driver</option>
        </select>
      </label>
      <p className="hint">{role === "driver" ? "Dereva anapangiwa gari moja." : "Manager anaweza kupangiwa magari kadhaa."}</p>
      <div className="pick-list">
        {vehicles.map((v) => (
          <label key={v.id} className="pick-item">
            <input type="checkbox" checked={picked.includes(v.id)} onChange={() => toggle(v.id)} />
            <span>{v.name}</span>
          </label>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={busy}>{busy ? "Inahifadhi..." : "Hifadhi"}</button>
        <button type="button" className="ghost" onClick={onCancel}>Funga</button>
      </div>
    </form>
  );
}

function initials(name: string): string {
  return name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

export default function UsersPage({ vehicles }: { vehicles: Vehicle[] }) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<TeamRole>("manager");
  const [picked, setPicked] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | TeamRole>("ALL");

  async function load() {
    try { setTeam(await listTeam()); setError(""); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  // A driver is assigned one vehicle; a manager can have several.
  function toggle(id: number) {
    setPicked((cur) => {
      if (role === "driver") return cur.includes(id) ? [] : [id];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("Nenosiri lazima liwe na herufi 6 au zaidi."); return; }
    if (role === "driver" && picked.length !== 1) { setError("Chagua gari moja kwa dereva."); return; }
    setBusy(true);
    try {
      await createTeamMember({ username: username.trim(), password, role, phone: phone.trim(), vehicles: picked });
      setNotice("Mtumiaji amesajiliwa.");
      setUsername(""); setPassword(""); setPhone(""); setPicked([]);
      setError("");
      setShowAdd(false);
      load();
    } catch (err) { setNotice(""); setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(m: TeamMember) {
    if (!confirm(`Futa ${m.username} kutoka kwenye timu?`)) return;
    try { await deleteTeamMember(m.id); setNotice("Mtumiaji amefutwa."); setError(""); load(); }
    catch (err) { setNotice(""); setError((err as Error).message); }
  }

  const managers = team.filter((m) => m.role === "manager").length;
  const drivers = team.filter((m) => m.role === "driver").length;

  // Search looks at name, phone and vehicle names.
  const q = search.trim().toLowerCase();
  const shown = team.filter((m) => {
    if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
    if (!q) return true;
    const text = [m.username, m.phone, ...m.vehicles.map((v) => v.name)].join(" ").toLowerCase();
    return text.includes(q);
  });

  return (
    <div className="up">
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <header className="up-head">
        <span className="up-head-ico">👥</span>
        <div>
          <h2>Users</h2>
          <p>Manage your team members</p>
        </div>
      </header>

      <section className="up-stats">
        <div className="up-stat blue"><span className="up-stat-ico">👔</span><div><b>{managers}</b><small>Managers</small></div></div>
        <div className="up-stat orange"><span className="up-stat-ico">🧢</span><div><b>{drivers}</b><small>Drivers</small></div></div>
        <div className="up-stat green"><span className="up-stat-ico">👥</span><div><b>{team.length}</b><small>Total Users</small></div></div>
      </section>

      <button type="button" className="up-add" onClick={() => setShowAdd((s) => !s)} aria-expanded={showAdd}>
        {showAdd ? "× Funga fomu" : "+ Ongeza Mtumiaji"}
      </button>

      {showAdd && (
        <section className="card up-form">
          <h3>Sajili Manager au Driver</h3>
          <form onSubmit={submit}>
            <label>Jina la mtumiaji
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mfano: hemed" required />
            </label>
            <label>Nenosiri (herufi 6 au zaidi)
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </label>
            <label>Simu
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0712345678" />
            </label>
            <label>Role
              <select value={role} onChange={(e) => { setRole(e.target.value as TeamRole); setPicked([]); }}>
                <option value="manager">Manager</option>
                <option value="driver">Driver</option>
              </select>
            </label>
            <p className="hint">{role === "driver" ? "Dereva anapangiwa gari moja." : "Manager anaweza kupangiwa magari kadhaa."}</p>
            <div className="pick-list">
              {vehicles.length === 0 && <p className="empty">Hakuna gari bado.</p>}
              {vehicles.map((v) => (
                <label key={v.id} className="pick-item">
                  <input type="checkbox" checked={picked.includes(v.id)} onChange={() => toggle(v.id)} />
                  <span>{v.name}</span>
                </label>
              ))}
            </div>
            <button type="submit" disabled={busy}>{busy ? "Inasajili..." : "Sajili Mtumiaji"}</button>
          </form>
        </section>
      )}

      <div className="up-tools">
        <label className="up-search">
          <span>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or vehicle..."
            aria-label="Search"
          />
        </label>
        <select className="up-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as "ALL" | TeamRole)} aria-label="Role">
          <option value="ALL">All Roles</option>
          <option value="manager">Managers</option>
          <option value="driver">Drivers</option>
        </select>
      </div>

      <ul className="up-list">
        {team.length === 0 && <li className="up-empty">Bado hujasajili mtu yeyote</li>}
        {team.length > 0 && shown.length === 0 && <li className="up-empty">Hakuna mtumiaji aliyepatikana</li>}
        {shown.map((m) => (
          <li key={m.id} className={"up-card " + m.role}>
            {editingId === m.id ? (
              <div className="up-editor">
                <TeamEditor
                  member={m}
                  vehicles={vehicles}
                  onSaved={() => { setEditingId(null); setNotice("Mabadiliko yamehifadhiwa."); load(); }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div className="up-row">
                <span className={"up-avatar " + m.role} aria-hidden="true">{initials(m.username)}</span>
                <div className="up-info">
                  <b className="up-name">{m.username}</b>
                  <span className="up-line">📞 {m.phone || "—"}</span>
                  <span className="up-line">🚘 {m.vehicles.length ? m.vehicles.map((v) => v.name).join(", ") : "Hakuna gari"}</span>
                </div>
                <div className="up-side">
                  <span className={"up-badge " + m.role}>{m.role === "manager" ? "Manager" : "Driver"}</span>
                  <div className="up-actions">
                    <button type="button" className="up-btn edit" aria-label={`Hariri ${m.username}`}
                      onClick={() => { setEditingId(m.id); setNotice(""); }}>✏️</button>
                    <button type="button" className="up-btn del" aria-label={`Futa ${m.username}`}
                      onClick={() => remove(m)}>🗑️</button>
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <footer className="up-foot">
        <span className="up-foot-ico">👥</span>
        <div>
          <b>Total Users: {team.length}</b>
          <small>{managers} Managers, {drivers} Drivers</small>
        </div>
        <span className="up-brand">AdyBajaj<em>Together We Grow</em></span>
      </footer>
    </div>
  );
}
