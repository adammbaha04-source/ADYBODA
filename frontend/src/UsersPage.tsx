import { useEffect, useState, type FormEvent } from "react";
import { createTeamMember, deleteTeamMember, listTeam } from "./api";
import { updateTeamMember } from "./api_extra";
import type { TeamMember, Vehicle } from "./types";

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
      load();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(m: TeamMember) {
    if (!confirm(`Futa ${m.username} kutoka kwenye timu?`)) return;
    try { await deleteTeamMember(m.id); setNotice("Mtumiaji amefutwa."); load(); }
    catch (err) { setError((err as Error).message); }
  }

  return (
    <>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <section className="card">
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

      <section className="card">
        <h3>Timu Yako</h3>
        <ul className="team-list">
          {team.length === 0 && <li className="empty">Bado hujasajili mtu yeyote</li>}
          {team.map((m) => (
            <li key={m.id} className="team-item" style={editingId === m.id ? { display: "block" } : undefined}>
              {editingId === m.id ? (
                <TeamEditor
                  member={m}
                  vehicles={vehicles}
                  onSaved={() => { setEditingId(null); setNotice("Mabadiliko yamehifadhiwa."); load(); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div className="team-main">
                    <b>{m.username}</b>
                    <span className={"role-badge " + m.role}>{m.role.toUpperCase()}</span>
                  </div>
                  <div className="team-sub">
                    {m.phone ? `Simu: ${m.phone} · ` : ""}
                    {m.vehicles.length ? `Gari: ${m.vehicles.map((v) => v.name).join(", ")}` : "Hakuna gari"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="ghost" onClick={() => { setEditingId(m.id); setNotice(""); }}>Hariri</button>
                    <button className="danger" onClick={() => remove(m)}>Futa</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
