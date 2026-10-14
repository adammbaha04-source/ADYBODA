import { useEffect, useState } from "react";
import { getMe, patchMe, type MeProfile } from "./api";
import { BACKGROUND_LABELS, PALETTES, applyAppearance } from "./theme";

const ACCENTS = ["#f97316", "#6366f1", "#0ea5e9", "#10b981", "#ec4899", "#8b5cf6", "#eab308"];

export default function SettingsPage() {
  const [me, setMe] = useState<MeProfile | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { getMe().then(setMe).catch((e: Error) => setError(e.message)); }, []);

  async function change(data: Partial<Pick<MeProfile, "theme" | "background" | "accent">>) {
    if (!me) return;
    const optimistic = { ...me, ...data };
    setMe(optimistic);
    applyAppearance(optimistic);             // show the change at once
    try {
      const saved = await patchMe(data);
      setMe(saved); applyAppearance(saved);
      setNotice("Mipangilio imehifadhiwa.");
    } catch (err) { setError((err as Error).message); }
  }

  if (!me) return <p className="hint">{error || "Inapakia..."}</p>;

  return (
    <>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <section className="card">
        <h3>Muonekano</h3>
        <label className="switch-row">
          <span><b>Dark mode</b><br /><small className="hint">Badilisha kati ya mwanga na giza.</small></span>
          <input type="checkbox" checked={me.theme === "dark"} onChange={(e) => change({ theme: e.target.checked ? "dark" : "light" })} />
        </label>
      </section>

      <section className="card">
        <h3>Background</h3>
        <div className="bg-grid">
          {Object.keys(PALETTES).map((k) => {
            const [a, b, c] = PALETTES[k];
            return (
              <button key={k} className={"bg-card" + (me.background === k ? " on" : "")} onClick={() => change({ background: k })}>
                <div className="bg-swatch" style={{ background: `linear-gradient(135deg, ${a}, ${b}, ${c})` }} />
                <span>{BACKGROUND_LABELS[k]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3>Rangi ya msisitizo</h3>
        <div className="swatch-row">
          {ACCENTS.map((c) => (
            <button key={c} className={"swatch" + (me.accent === c ? " on" : "")} style={{ background: c }}
              aria-label={`Rangi ${c}`} onClick={() => change({ accent: c })} />
          ))}
        </div>
        <label className="color-pick">Chagua rangi yako
          <input type="color" value={me.accent} onChange={(e) => change({ accent: e.target.value })} />
        </label>
      </section>
    </>
  );
}
