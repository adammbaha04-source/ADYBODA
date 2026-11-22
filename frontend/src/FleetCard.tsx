import type { Vehicle } from "./types";

const money = (n: number) => `TSh ${Math.round(n).toLocaleString("en-US")}`;

const CSS = `
.fc{border-radius:26px;overflow:hidden;background:#fff;margin:14px 0;box-shadow:0 10px 28px rgba(30,64,175,.18);border:1px solid #dbe6fb}
.fc-head{padding:14px;color:#fff}.fc-blue{background:linear-gradient(135deg,#1d4ed8,#0b3aa8)}.fc-green{background:linear-gradient(135deg,#16a34a,#0f6b32)}
.fc-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.fc-top h3{margin:0;font-size:22px;font-weight:900;color:#fff}
.fc-b{padding:4px 10px;border-radius:14px;font-size:12px;font-weight:900;background:#22c55e;color:#fff}.fc-act{background:#16a34a;border:1px solid #bbf7d0}
.fc-drv{margin:8px 0 0;font-size:14px;font-weight:700}
.fc-body{padding:12px}.fc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fc-tile{position:relative;border-radius:20px;padding:8px 6px 10px;border:1px solid #e5e7f3;text-align:center;min-width:0}
.fc-t-red{background:#fff5f5}.fc-t-green{background:#f0fdf4}.fc-t-purple{background:#faf5ff}.fc-t-orange{background:#fffaf0}
.fc-pill{display:inline-block;padding:3px 16px;border-radius:14px;color:#fff;font-size:13px;font-weight:900}
.fc-gauge{width:100%;height:auto;display:block;margin-top:2px}.fc-track,.fc-val{fill:none;stroke-width:11;stroke-linecap:round}.fc-track{stroke:#dfe5f1}
.fc-center{margin-top:-30px;position:relative}.fc-center b{display:block;font-size:20px;color:#102b66;font-weight:950}.fc-center span{display:block;font-size:13px;font-weight:900}.fc-center small{display:block;font-size:12px;color:#445}
.fc-table{margin-top:12px;border:1px solid #dbe6fb;border-radius:18px;background:#f3f8ff;padding:4px 12px}
.fc-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #e1e9f7;font-size:14px;color:#29416f}.fc-row:last-child{border-bottom:0}.fc-row b{font-size:16px;font-weight:900}
.fc-tip{margin-top:12px;padding:10px 12px;border-radius:16px;background:#e7f1ff;border:1px solid #cfe0ff;font-size:13px;color:#102b66}.fc-tip b{display:block;font-size:14px}
.fc-btns{display:flex;gap:12px;justify-content:center;margin-top:12px}
.fc-btn{border:0;border-radius:24px;padding:11px 26px;font-size:16px;font-weight:900;color:#fff;cursor:pointer}.fc-edit{background:linear-gradient(135deg,#2563eb,#1d4ed8)}.fc-del{background:linear-gradient(135deg,#ef4444,#c81e1e)}
`;

function Gauge({ pct, from, to, id }: { pct: number; from: string; to: string; id: string }) {
  const p = Math.min(100, Math.max(0, pct));
  return (
    <svg viewBox="0 0 120 68" className="fc-gauge">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path d="M 12 62 A 48 48 0 0 1 108 62" pathLength={100} className="fc-track" />
      <path d="M 12 62 A 48 48 0 0 1 108 62" pathLength={100} className="fc-val" stroke={`url(#${id})`} strokeDasharray={`${p} 100`} />
    </svg>
  );
}

function Tile(props: { cls: string; label: string; pill: string; pct: number; from: string; to: string; id: string; big: string; sub: string; subColor: string }) {
  return (
    <div className={`fc-tile ${props.cls}`}>
      <span className="fc-pill" style={{ background: props.pill }}>{props.label}</span>
      <Gauge pct={props.pct} from={props.from} to={props.to} id={props.id} />
      <div className="fc-center">
        <b>{props.big}</b>
        <span style={{ color: props.subColor }}>{props.sub}</span>
      </div>
    </div>
  );
}

export default function FleetCard(p: {
  vehicle: Vehicle; index: number; driverName: string; driverPhone: string;
  target: number; paid: number; debt: number; lostDays: number; totalDays: number;
  canManage: boolean; onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { vehicle: v, target, paid, debt, lostDays, totalDays } = p;
  const lostAmount = lostDays * v.daily_target;
  const debtPct = target > 0 ? (debt / target) * 100 : 0;
  const incomePct = target > 0 ? (paid / target) * 100 : 0;
  const dayPct = totalDays > 0 ? (lostDays / totalDays) * 100 : 0;
  const lossPct = target > 0 ? (lostAmount / target) * 100 : 0;
  const key = String(v.id).replace(/[^a-zA-Z0-9_-]/g, "-");
  const tip = debt <= 0
    ? "Hongera! Hakuna deni, endelea hivyo."
    : lostDays > 0
      ? "Ongeza mapato ya ziada na rekebisha ratiba."
      : "Endelea kuongeza mapato na punguza deni!";
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  return (
    <article className="fc" onClick={p.onOpen}>
      <style>{CSS}</style>
      <div className={`fc-head ${p.index % 2 === 0 ? "fc-blue" : "fc-green"}`}>
        <div className="fc-top">
          <h3>{v.name}</h3>
          <span className="fc-b">{v.vehicle_type.toUpperCase()}</span>
          <span className="fc-b fc-act">✓ Active</span>
        </div>
        <p className="fc-drv">{p.driverName ? `Driver: ${p.driverName}${p.driverPhone ? "  📞 " + p.driverPhone : ""}` : "Hakuna dereva"}</p>
      </div>
      <div className="fc-body">
        <div className="fc-grid">
          <Tile cls="fc-t-red" label="Debt" pill="#ef4444" pct={debtPct} from="#f87171" to="#dc2626" id={`d-${key}`} big={`${Math.round(debtPct)}%`} sub={money(debt)} subColor="#dc2626" />
          <Tile cls="fc-t-green" label="Income" pill="#22c55e" pct={incomePct} from="#4ade80" to="#16a34a" id={`i-${key}`} big={`${Math.round(incomePct)}%`} sub={money(paid)} subColor="#16a34a" />
          <Tile cls="fc-t-purple" label="Day Loss" pill="#7c3aed" pct={dayPct} from="#a78bfa" to="#7c3aed" id={`l-${key}`} big={`${lostDays} / ${totalDays}`} sub="Working Days" subColor="#6d28d9" />
          <Tile cls="fc-t-orange" label="Loss Amount" pill="#f59e0b" pct={lossPct} from="#fbbf24" to="#f97316" id={`a-${key}`} big={money(lostAmount)} sub="This Month" subColor="#d97706" />
        </div>
        <div className="fc-table">
          <div className="fc-row"><span>🎯 Target (Month)</span><b style={{ color: "#1d4ed8" }}>{money(target)}</b></div>
          <div className="fc-row"><span>💰 Income (Month)</span><b style={{ color: "#16a34a" }}>{money(paid)}</b></div>
          <div className="fc-row"><span>🪙 Debt (Month)</span><b style={{ color: "#dc2626" }}>{money(debt)}</b></div>
          <div className="fc-row"><span>📅 Day Loss</span><b style={{ color: "#7c3aed" }}>{lostDays} / {totalDays} days</b></div>
          <div className="fc-row"><span>📉 Loss Amount</span><b style={{ color: "#f97316" }}>{money(lostAmount)}</b></div>
        </div>
        <div className="fc-tip">💡 <b>AI Suggestion:</b>{tip}</div>
        {p.canManage && (
          <div className="fc-btns">
            <button className="fc-btn fc-edit" onClick={stop(p.onEdit)}>✏️ Edit</button>
            <button className="fc-btn fc-del" onClick={stop(p.onDelete)}>🗑️ Delete</button>
          </div>
        )}
      </div>
    </article>
  );
}
