import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { getMe, patchMe, type MeProfile } from "./api";
import { fileToAvatar } from "./theme";
import { useFeedback } from "./feedback";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", driver: "Driver" };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
type Field = "name" | "phone" | "email";

export default function ProfilePage({ onChanged }: { onChanged: (p: MeProfile) => void }) {
  const fb = useFeedback();
  const [me, setMe] = useState<MeProfile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [avatar, setAvatar] = useState("");
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMe().then((p) => { setMe(p); setAvatar(p.avatar); })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  // Inatuma data kwa server. Ikifanikiwa: popup ya ushindi. Ikishindwa: popup ya kosa yenye ujumbe wa server.
  async function run(data: Parameters<typeof patchMe>[0], okMsg: string, failTitle?: string): Promise<boolean> {
    setBusy(true);
    try {
      const updated = await patchMe(data);
      setMe(updated); setAvatar(updated.avatar); onChanged(updated);
      setEditing(null);
      fb.success(okMsg);
      return true;
    } catch (err) {
      fb.error((err as Error).message, failTitle);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const url = await fileToAvatar(f);
      await run({ avatar: url }, "Picha imebadilishwa.", "Picha haikuhifadhiwa");
    } catch (err) {
      fb.error((err as Error).message, "Picha haikubaliki");
    }
  }

  function startEdit(field: Field) {
    if (!me) return;
    setDraft(field === "name" ? me.full_name : field === "phone" ? me.phone : me.email);
    setEditing(field);
  }

  function saveField(e: FormEvent) {
    e.preventDefault();
    const value = draft.trim();
    if (editing === "email") {
      if (!value) return fb.warning("Email haiwezi kuwa tupu.", "Email inahitajika");
      if (!EMAIL_RE.test(value)) return fb.warning("Andika email sahihi, mfano jina@mfano.com.", "Email si sahihi");
      return void run({ email: value }, "Email imehifadhiwa.", "Email imetumika");
    }
    if (editing === "phone") {
      if (value && !/^\+?[0-9\s]{9,15}$/.test(value)) return fb.warning("Namba ya simu si sahihi. Mfano: 0712345678.", "Namba si sahihi");
      return void run({ phone: value.replace(/\s/g, "") }, "Namba ya simu imehifadhiwa.", "Namba haikuhifadhiwa");
    }
    if (editing === "name") {
      if (!value) return fb.warning("Jina haliwezi kuwa tupu.", "Jina inahitajika");
      return void run({ full_name: value }, "Jina limehifadhiwa.", "Jina haikuhifadhiwa");
    }
  }

  if (!me) return <p className="hint">{loadError || "Inapakia..."}</p>;
  const initial = (me.full_name || me.username).charAt(0).toUpperCase();

  const rows: { field: Field; label: string; value: string }[] = [
    { field: "phone", label: "Namba ya simu", value: me.phone },
    { field: "email", label: "Email", value: me.email },
  ];

  return (
    <div className="profile-page">
      <section className="card profile-hero">
        <div className="profile-cover" />
        <div className="profile-id">
          <div className="avatar-wrap">
            <div className="avatar-big">
              {avatar ? <img src={avatar} alt="Picha ya profile" /> : <span>{initial}</span>}
            </div>
            <button type="button" className="avatar-btn avatar-cam" title="Badili picha"
              onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Badili picha">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>
            {avatar && (
              <button type="button" className="avatar-btn avatar-del" title="Ondoa picha"
                onClick={() => run({ avatar: "" }, "Picha imeondolewa.", "Picha haikuondolewa")} disabled={busy} aria-label="Ondoa picha">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} hidden />
          </div>

          <div className="profile-title">
            {editing === "name" ? (
              <form className="inline-edit" onSubmit={saveField}>
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Jina lako" />
                <InlineActions busy={busy} onCancel={() => setEditing(null)} />
              </form>
            ) : (
              <h2 className="profile-name">
                {me.full_name || me.username}
                <button type="button" className="icon-edit" onClick={() => startEdit("name")} aria-label="Hariri jina">Hariri</button>
              </h2>
            )}
            <p className="profile-handle">@{me.username}</p>
            <span className="role-badge">{ROLE_LABEL[me.role] ?? me.role}</span>
          </div>
        </div>
      </section>

      <section className="card profile-section">
        <h3>Taarifa za mawasiliano</h3>
        {rows.map((r) => (
          <div className="contact-row" key={r.field}>
            <div className="contact-label">{r.label}</div>
            {editing === r.field ? (
              <form className="inline-edit" onSubmit={saveField}>
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                  inputMode={r.field === "phone" ? "tel" : "email"}
                  placeholder={r.field === "phone" ? "0712345678" : "jina@mfano.com"} />
                <InlineActions busy={busy} onCancel={() => setEditing(null)} />
              </form>
            ) : (
              <div className="contact-value">
                <span>{r.value || "Haijawekwa"}</span>
                <button type="button" className="icon-edit" onClick={() => startEdit(r.field)}>Hariri</button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="card profile-section">
        <h3>Taarifa za akaunti</h3>
        <div className="info-list">
          <div><span>Jukumu</span><b>{ROLE_LABEL[me.role] ?? me.role}</b></div>
          <div><span>Biashara</span><b>{me.business_owner}</b></div>
          <div><span>Magari</span><b>{me.vehicles.length ? me.vehicles.map((v) => v.name).join(", ") : "—"}</b></div>
        </div>
      </section>
    </div>
  );
}

function InlineActions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <div className="inline-actions">
      <button type="button" className="ghost" onClick={onCancel} disabled={busy}>Ghairi</button>
      <button type="submit" disabled={busy}>{busy ? "Inahifadhi..." : "Hifadhi"}</button>
    </div>
  );
}
