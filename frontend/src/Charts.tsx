// Small dependency-free charts: a pie and horizontal percentage bars.
const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];

export interface Slice { label: string; value: number; }

export function Pie({ data }: { data: Slice[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total <= 0) return <p className="empty">Hakuna data ya kuonyesha</p>;
  let angle = -Math.PI / 2;
  return (
    <div className="pie-wrap">
      <svg viewBox="0 0 200 200" className="pie" role="img" aria-label="Pie chart">
        {data.map((d, i) => {
          const frac = d.value / total;
          const color = COLORS[i % COLORS.length];
          if (frac >= 0.9999) return <circle key={d.label} cx={100} cy={100} r={80} fill={color} />;
          const a2 = angle + frac * 2 * Math.PI;
          const x1 = 100 + 80 * Math.cos(angle), y1 = 100 + 80 * Math.sin(angle);
          const x2 = 100 + 80 * Math.cos(a2), y2 = 100 + 80 * Math.sin(a2);
          const large = frac > 0.5 ? 1 : 0;
          angle = a2;
          return <path key={d.label} d={`M100,100 L${x1},${y1} A80,80 0 ${large} 1 ${x2},${y2} Z`} fill={color} />;
        })}
      </svg>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.label}>
            <span className="dot" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="lname">{d.label}</span>
            <b>{Math.round((d.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Bar({ label, percent, color, text }: { label: string; percent: number; color: string; text?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="bar-row">
      <div className="bar-top"><span>{label}</span><b>{text ?? `${p}%`}</b></div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${p}%`, background: color }} /></div>
    </div>
  );
}
