const MONTHS_SW = ["Januari", "Februari", "Machi", "Aprili", "Mei", "Juni", "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba"];

function monthText(m: string): string {
  const [y, mo] = m.split("-");
  const i = Number(mo) - 1;
  return i >= 0 && i <= 11 ? `${MONTHS_SW[i]} ${y}` : m;
}

function shift(m: string, d: number): string {
  const [y, mo] = m.split("-").map(Number);
  const dt = new Date(y, mo - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

type Props = {
  month: string;
  onMonth: (m: string) => void;
  showWeek: boolean;
  mode: "month" | "week";
  onMode: (m: "month" | "week") => void;
  week: number;
  weeks: number[];
  onWeek: (w: number) => void;
};

// The ONE period bar of the app: month with arrows, and (only where it is used) Mwezi/Wiki + week chips.
export default function PeriodBar({ month, onMonth, showWeek, mode, onMode, week, weeks, onWeek }: Props) {
  return (
    <section className="pb">
      <style>{CSS}</style>
      <div className="pb-row">
        <button type="button" className="pb-nav" aria-label="Mwezi uliopita" onClick={() => onMonth(shift(month, -1))}>‹</button>
        <label className="pb-month">
          <span>📅 {monthText(month)}</span>
          <input type="month" value={month} aria-label="Chagua mwezi" onChange={(e) => e.target.value && onMonth(e.target.value)} />
        </label>
        <button type="button" className="pb-nav" aria-label="Mwezi unaofuata" onClick={() => onMonth(shift(month, 1))}>›</button>
      </div>
      {showWeek && (
        <>
          <div className="pb-seg">
            <button type="button" className={mode === "month" ? "on" : ""} onClick={() => onMode("month")}>Mwezi</button>
            <button type="button" className={mode === "week" ? "on" : ""} onClick={() => onMode("week")}>Wiki</button>
          </div>
          {mode === "week" && (
            <div className="pb-weeks">
              {weeks.map((w) => (
                <button type="button" key={w} className={week === w ? "on" : ""} onClick={() => onWeek(w)}>Wiki {w}</button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

const CSS = `
.pb{margin:0 0 12px;padding:12px;border-radius:22px;color:#fff;background:linear-gradient(135deg,#0b2a6b,#0a1f4d);box-shadow:0 8px 20px rgba(10,31,77,.3)}
.pb-row{display:flex;align-items:center;gap:8px}
.pb-nav{flex:none;width:44px;height:44px;padding:0;border:0;border-radius:50%;font-size:26px;line-height:1;color:#fff;background:rgba(255,255,255,.16);cursor:pointer}
.pb-month{position:relative;flex:1;display:grid;place-items:center;height:44px;margin:0;border-radius:999px;font-size:16px;font-weight:700;color:#0b2a5b;background:#fff;overflow:hidden}
.pb-month input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.pb-seg{display:flex;gap:4px;margin-top:10px;padding:4px;border-radius:999px;background:rgba(255,255,255,.14)}
.pb-seg button{flex:1;padding:9px 0;border:0;border-radius:999px;font-size:14px;font-weight:700;color:#dbe7ff;background:transparent;cursor:pointer}
.pb-seg button.on{color:#fff;background:linear-gradient(90deg,#f97316,#f59e0b)}
.pb-weeks{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.pb-weeks button{width:auto;padding:7px 12px;border:0;border-radius:999px;font-size:13px;font-weight:600;color:#dbe7ff;background:rgba(255,255,255,.14);cursor:pointer}
.pb-weeks button.on{color:#0b2a5b;background:#fde047}
`;
