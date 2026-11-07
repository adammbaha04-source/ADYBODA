import { useEffect, useMemo, useState } from "react";
import { listServices } from "./api";
import { shortDate } from "./format";
import type { ServiceRecord } from "./types";

// Edit distance between two words (how many letter changes turn one into the other).
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function daysBetween(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export default function ToolInput({
  vehicleIds, value, onChange, day, required,
}: {
  vehicleIds: number[];       // all vehicles of the owner, so spelling learns from every vehicle
  value: string;
  onChange: (v: string) => void;
  day: string;                // the date of the service being entered (YYYY-MM-DD)
  required?: boolean;
}) {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all(vehicleIds.map((id) => listServices(id).catch(() => [] as ServiceRecord[])))
      .then((lists) => { if (alive) setRecords(lists.flat()); });
    return () => { alive = false; };
  }, [vehicleIds.join(",")]);

  // Every tool name already used, with how many times.
  const known = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    for (const r of records) {
      const k = norm(r.tool);
      if (!k) continue;
      const cur = m.get(k);
      m.set(k, { name: cur?.name ?? r.tool.trim(), count: (cur?.count ?? 0) + 1 });
    }
    return [...m.values()];
  }, [records]);

  const typed = norm(value);
  const exact = known.find((k) => norm(k.name) === typed);

  // Spelling suggestions: names that contain what was typed, or are only a letter or two away.
  const suggestions = useMemo(() => {
    if (!typed || exact) return [];
    const limit = Math.max(1, Math.floor(typed.length / 3));
    return known
      .map((k) => ({ ...k, dist: editDistance(typed, norm(k.name)), contains: norm(k.name).includes(typed) }))
      .filter((k) => k.contains || k.dist <= limit)
      .sort((a, b) => Number(b.contains) - Number(a.contains) || a.dist - b.dist || b.count - a.count)
      .slice(0, 4);
  }, [typed, exact, known]);

  // Last time this exact tool was filled, from all records.
  const lastRecord = useMemo(() => {
    if (!exact) return null;
    return records
      .filter((r) => norm(r.tool) === norm(exact.name))
      .sort((a, b) => b.day.localeCompare(a.day))[0] ?? null;
  }, [exact, records]);

  const lastDays = lastRecord ? daysBetween(lastRecord.day, day) : null;

  return (
    <div className="tool-input">
      <label>
        Kifaa (Tool) {required && "*"}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Mfano: Vikombe, Mafuta, Filter"
          autoComplete="off"
          required={required}
        />
      </label>

      {focused && suggestions.length > 0 && (
        <div className="ti-suggest">
          <span className="ti-suggest-label">Ulimaanisha?</span>
          {suggestions.map((s) => (
            <button key={s.name} type="button" className="ti-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(s.name)}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {lastRecord && lastDays !== null && (
        <p className="ti-last">
          Mara ya mwisho <b>{exact?.name}</b> ilijazwa: <b>{shortDate(lastRecord.day)}</b>
          {lastDays >= 0 ? ` · siku ${lastDays} zilizopita` : " · tarehe ya baadaye kuliko ya leo"}
        </p>
      )}
    </div>
  );
}
