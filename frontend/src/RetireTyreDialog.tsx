import { useState, type FormEvent } from "react";
import { createTyre, listTyres, updateTyre } from "./api";
import { shortDate, todayYMD, tsh } from "./format";
import type { Vehicle } from "./types";

// A tyre row as the API returns it (vehicle and retired_on come from migration 0013).
type TyreRow = {
  id: number;
  vehicle: number;
  day: string;
  tyre_number: string;
  amount: number;
  note: string;
  retired_on: string | null;
};

type Lookup =
  | { status: "none" }
  | { status: "active"; row: TyreRow; vehicleName: string; days: number }
  | { status: "retired"; row: TyreRow; vehicleName: string; retiredOn: string };

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

function daysBetween(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Looks a tyre number up across every vehicle the owner can see.
async function findTyre(number: string, vehicles: Vehicle[], today: string): Promise<Lookup & { all: TyreRow[] }> {
  const target = norm(number);
  const lists = await Promise.all(vehicles.map((v) => listTyres(v.id).then((rows) => ({ v, rows: rows as TyreRow[] }))));
  const hits: { row: TyreRow; vehicleName: string }[] = [];
  for (const { v, rows } of lists) {
    for (const r of rows) if (norm(r.tyre_number) === target) hits.push({ row: r, vehicleName: v.name });
  }
  const all = hits.map((h) => h.row);
  if (hits.length === 0) return { status: "none", all };

  // Prefer the record that is still in service. Otherwise show the latest retired one.
  const active = hits.filter((h) => !h.row.retired_on).sort((a, b) => b.row.day.localeCompare(a.row.day))[0];
  if (active) {
    return { status: "active", row: active.row, vehicleName: active.vehicleName, days: daysBetween(active.row.day, today), all };
  }
  const last = hits.sort((a, b) => (b.row.retired_on ?? "").localeCompare(a.row.retired_on ?? ""))[0];
  return { status: "retired", row: last.row, vehicleName: last.vehicleName, retiredOn: last.row.retired_on ?? "", all };
}

export default function RetireTyreDialog({
  vehicle, allVehicles, defaultDay, onDone,
}: {
  vehicle: Vehicle;          // the vehicle the NEW tyre goes on
  allVehicles: Vehicle[];    // the owner's vehicles, used for the system check
  defaultDay: string;
  onDone: (msg: string) => void;
}) {
  const today = todayYMD();

  // Old tyre (optional)
  const [oldNo, setOldNo] = useState("");
  const [retireDate, setRetireDate] = useState(today);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [checking, setChecking] = useState(false);

  // New tyre (required)
  const [newNo, setNewNo] = useState("");
  const [newDay, setNewDay] = useState(defaultDay);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!oldNo.trim()) { setError("Andika namba ya tairi iliyoharibika."); return; }
    setChecking(true); setError("");
    try {
      const res = await findTyre(oldNo, allVehicles, retireDate);
      setLookup(res);
    } catch (e) { setError((e as Error).message); }
    finally { setChecking(false); }
  }

  // Days in service recalculated when the retire date changes.
  const activeDays = lookup?.status === "active" ? daysBetween(lookup.row.day, retireDate) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Old tyre: if one was typed, it must be verified and still in service.
    if (oldNo.trim()) {
      // lookup is cleared whenever the old number changes, so a non-null lookup always matches oldNo.
      if (!lookup) {
        setError("Bonyeza Hakiki kwanza kuthibitisha tairi iliyoharibika.");
        return;
      }
      if (lookup.status === "none") { setError("Namba hii ya tairi haipo kwenye mfumo."); return; }
      if (lookup.status === "retired") { setError(`Tairi hii tayari iliondolewa tarehe ${shortDate(lookup.retiredOn)}.`); return; }
      if (retireDate < lookup.row.day) { setError("Tarehe ya kuondolewa haiwezi kuwa kabla ya tarehe ya kufungwa."); return; }
    }

    // New tyre: its number must not already be in service on any vehicle.
    setBusy(true);
    try {
      const clash = await findTyre(newNo, allVehicles, today);
      if (clash.status === "active") {
        setError(`Namba ${newNo.trim()} tayari iko kwenye gari ${clash.vehicleName}.`);
        return;
      }

      if (lookup?.status === "active") {
        await updateTyre(lookup.row.id, { retired_on: retireDate });
      }
      await createTyre(vehicle.id, newDay, newNo.trim(), Number(amount) || 0, note.trim());

      const msg = lookup?.status === "active"
        ? `Tairi ${oldNo.trim()} imeondolewa. Tairi mpya ${newNo.trim()} imehifadhiwa.`
        : `Tairi ${newNo.trim()} imehifadhiwa.`;
      onDone(msg);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="retire-form">
      <h3>Tairi</h3>

      <fieldset className="rt-block">
        <legend>1. Tairi iliyoharibika au kuisha <small>(si lazima)</small></legend>
        <div className="rt-row">
          <label>Namba ya tairi mbovu / ya zamani
            <input value={oldNo} onChange={(e) => { setOldNo(e.target.value); setLookup(null); }} placeholder="mfano: TYRE001" />
          </label>
          <button type="button" className="ghost rt-check" onClick={check} disabled={checking || !oldNo.trim()}>
            {checking ? "Inakagua..." : "Hakiki"}
          </button>
        </div>

        {lookup?.status === "none" && (
          <p className="rt-result bad">❌ Namba hii haipo kwenye mfumo. Hakikisha namba.</p>
        )}

        {lookup?.status === "retired" && (
          <p className="rt-result bad">⚠️ Tairi hii tayari iliondolewa tarehe {shortDate(lookup.retiredOn)}, gari {lookup.vehicleName}.</p>
        )}

        {lookup?.status === "active" && (
          <div className="rt-result ok">
            <div>✅ Inatambulika kwenye mfumo</div>
            <div className="rt-kv">Gari: <b>{lookup.vehicleName}</b></div>
            <div className="rt-kv">Ilifungwa: <b>{shortDate(lookup.row.day)}</b></div>
            <div className="rt-kv">Imefanya kazi: <b>siku {activeDays ?? lookup.days}</b></div>
            {lookup.vehicleName !== vehicle.name && (
              <div className="rt-warn">Tairi hii ni ya gari {lookup.vehicleName}, si {vehicle.name}. Hakikisha imehamishwa.</div>
            )}
            <label className="rt-date">Tarehe ya kuondolewa
              <input type="date" value={retireDate} min={lookup.row.day} onChange={(e) => setRetireDate(e.target.value)} />
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="rt-block">
        <legend>2. Tairi mpya <small>(lazima)</small></legend>
        <label>Namba ya tairi mpya *
          <input value={newNo} onChange={(e) => setNewNo(e.target.value)} placeholder="mfano: TYRE045" required />
        </label>
        <label>Tarehe ya kufunga
          <input type="date" value={newDay} onChange={(e) => setNewDay(e.target.value)} required />
        </label>
        <label>Kiasi (TSh)
          <input type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>Maelezo
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Maelezo ya ziada" />
        </label>
        {Number(amount) > 0 && <p className="hint">Gharama: {tsh(Number(amount))}</p>}
      </fieldset>

      {error && <p className="error">{error}</p>}

      <div className="vd-actions">
        <button type="submit" disabled={busy || !newNo.trim()}>{busy ? "Inahifadhi..." : "Hifadhi"}</button>
      </div>
    </form>
  );
}
