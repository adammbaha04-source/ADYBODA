import { useState, type ChangeEvent, type FormEvent } from "react";
import { changeDriver, updateDriverPeriod } from "./api";
import { todayYMD } from "./format";
import type { Vehicle } from "./types";

// Why the previous driver was replaced. Shown only when a driver already exists.
export const REASONS = [
  "Dereva ameacha kazi",
  "Ameugua",
  "Amefukuzwa",
  "Gari limehamishwa",
  "Nyingine",
];

// Driver fields added on the backend (migration 0012). Older rows may not have them yet.
type DriverRow = Vehicle["driver_periods"][number] & {
  email?: string;
  residence?: string;
  guarantor_name?: string;
  guarantor_phone?: string;
};

type Mode = "edit" | "change" | null;

function blankForm() {
  return {
    name: "",
    phone: "",
    email: "",
    residence: "",
    guarantorName: "",
    guarantorPhone: "",
    from: todayYMD(),
    reason: "",
  };
}
type FormState = ReturnType<typeof blankForm>;

export default function DriverSection({ vehicle, onSaved }: { vehicle: Vehicle; onSaved: () => void }) {
  const latest = [...vehicle.driver_periods]
    .sort((a, b) => a.from_date.localeCompare(b.from_date))
    .pop() as DriverRow | undefined;
  const hasDriver = !!(latest && latest.driver_name);

  const [mode, setMode] = useState<Mode>(null);
  const [f, setF] = useState<FormState>(blankForm());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set =
    (k: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  // "Hariri dereva": fill the form with the current driver's details.
  function startEdit() {
    if (!latest) return;
    setF({
      name: latest.driver_name,
      phone: latest.phone,
      email: latest.email ?? "",
      residence: latest.residence ?? "",
      guarantorName: latest.guarantor_name ?? "",
      guarantorPhone: latest.guarantor_phone ?? "",
      from: latest.from_date,
      reason: "",
    });
    setMode("edit");
    setError("");
  }

  // "Badili dereva" / "Ongeza dereva": start with an empty form.
  function startChange() {
    setF(blankForm());
    setMode("change");
    setError("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) {
      setError("Jina la dereva linahitajika.");
      return;
    }
    if (mode === "change" && hasDriver && !f.reason) {
      setError("Chagua sababu ya kubadilisha.");
      return;
    }

    const details = {
      email: f.email.trim(),
      residence: f.residence.trim(),
      guarantor_name: f.guarantorName.trim(),
      guarantor_phone: f.guarantorPhone.trim(),
    };

    setBusy(true);
    setError("");
    try {
      if (mode === "edit" && latest) {
        // Same driver, corrected details. No new period is created.
        await updateDriverPeriod(latest.id, {
          driver_name: f.name.trim(),
          phone: f.phone.trim(),
          ...details,
        });
      } else {
        // New driver. Creates a new period starting on the chosen date.
        await changeDriver(vehicle.id, f.name.trim(), f.phone.trim(), f.from, {
          ...details,
          reason: hasDriver ? f.reason : "",
        });
      }
      setMode(null);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const formTitle =
    mode === "edit" ? "Hariri dereva" : hasDriver ? "Badili dereva" : "Ongeza dereva";

  return (
    <div className="driver-box">
      <div className="driver-head">Dereva</div>

      <p className="driver">
        {hasDriver
          ? `${latest!.driver_name}${latest!.phone ? " • " + latest!.phone : ""}`
          : "Hakuna dereva"}
      </p>

      <div className="driver-actions">
        {hasDriver && (
          <button
            type="button"
            className={"ghost" + (mode === "edit" ? " on" : "")}
            onClick={() => (mode === "edit" ? setMode(null) : startEdit())}
          >
            Hariri dereva
          </button>
        )}
        <button
          type="button"
          className={mode === "change" ? "on" : ""}
          onClick={() => (mode === "change" ? setMode(null) : startChange())}
        >
          {hasDriver ? "Badili dereva" : "Ongeza dereva"}
        </button>
      </div>

      {mode && (
        <form className="driver-form" onSubmit={save}>
          <h4>{formTitle}</h4>

          <label>
            Jina la dereva *
            <input value={f.name} onChange={set("name")} required />
          </label>
          <label>
            Anapoishi
            <input value={f.residence} onChange={set("residence")} />
          </label>
          <label>
            Barua pepe
            <input type="email" value={f.email} onChange={set("email")} />
          </label>
          <label>
            Namba ya simu
            <input inputMode="tel" value={f.phone} onChange={set("phone")} />
          </label>
          <label>
            Jina la mdhamini
            <input value={f.guarantorName} onChange={set("guarantorName")} />
          </label>
          <label>
            Namba ya simu ya mdhamini
            <input inputMode="tel" value={f.guarantorPhone} onChange={set("guarantorPhone")} />
          </label>

          {mode === "change" && (
            <>
              <label>
                Anaanza tarehe *
                <input type="date" value={f.from} onChange={set("from")} required />
              </label>
              {hasDriver && (
                <label>
                  Sababu ya kubadilisha *
                  <select value={f.reason} onChange={set("reason")} required>
                    <option value="">Chagua sababu</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {error && <p className="error">{error}</p>}

          <div className="row">
            <button type="submit" disabled={busy}>
              {busy ? "Inahifadhi..." : "Save"}
            </button>
            <button type="button" className="ghost" onClick={() => setMode(null)}>
              Funga
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
