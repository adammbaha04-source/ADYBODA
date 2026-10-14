import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { getMe, patchMe, type MeProfile } from "./api";
import { fileToAvatar } from "./theme";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", driver: "Driver" };

export default function ProfilePage({ onChanged }: { onChanged: (p: MeProfile) => void }) {
  const [me, setMe] = useState<MeProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMe().then((p) => { setMe(p); setFullName(p.full_name); setPhone(p.phone); setAvatar(p.avatar); })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setAvatar(await fileToAvatar(f)); setError(""); }
    catch (err) { setError((err as Error).message); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await patchMe({ full_name: fullName, phone, avatar });
      setMe(updated); onChanged(updated); setNotice("Profile imehifadhiwa.");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  if (!me) return <p className="hint">{error || "Inapakia..."}</p>;
  const initial = (me.full_name || me.username).charAt(0).toUpperCase();

  return (
    <>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <section className="card profile-card">
        <div className="avatar-big">
          {avatar ? <img src={avatar} alt="Profile" /> : <span>{initial}</span>}
        </div>
        <h3 className="center">{me.full_name || me.username}</h3>
        <p className="center hint">@{me.username}</p>
        <div className="info-list">
          <div><span>Role</span><b>{ROLE_LABEL[me.role] ?? me.role}</b></div>
          <div><span>Biashara</span><b>{me.business_owner}</b></div>
          <div><span>Email</span><b>{me.email || "—"}</b></div>
          <div><span>Simu</span><b>{me.phone || "—"}</b></div>
          <div><span>Magari</span><b>{me.vehicles.length ? me.vehicles.map((v) => v.name).join(", ") : "—"}</b></div>
        </div>
      </section>

      <section className="card form-card">
        <form onSubmit={save}>
          <h3>Hariri Profile</h3>
          <label>Jina kamili<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jina lako" /></label>
          <label>Namba ya simu<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0712345678" /></label>
          <label>Picha ya profile
            <input type="file" accept="image/*" onChange={pickPhoto} />
          </label>
          {avatar && <button type="button" className="ghost" onClick={() => setAvatar("")}>Ondoa picha</button>}
          <button type="submit" disabled={busy}>{busy ? "Inahifadhi..." : "Hifadhi Profile"}</button>
        </form>
      </section>
    </>
  );
}
