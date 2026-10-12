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

// Compact TSh label for axes: 1500000 -> "1.5M", 96000 -> "96k".
export function shortTsh(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a % 1_000_000 === 0 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)}k`;
  return `${sign}${Math.round(a)}`;
}

export interface SeriesDef { name: string; color: string; values: number[]; }

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}

/** Grouped bars: one group per label, one bar per series. Works with negative values. */
export function GroupBars({ labels, series, empty }: { labels: string[]; series: SeriesDef[]; empty?: string }) {
  if (labels.length === 0 || series.every((s) => s.values.every((v) => v === 0))) {
    return <p className="empty">{empty ?? "Hakuna data ya kuonyesha kwa kipindi hiki"}</p>;
  }
  const W = 640, H = 260, PL = 56, PB = 36, PT = 12, PR = 8;
  const all = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(0, ...all));
  const min = Math.min(0, ...all);
  const range = max - min || 1;
  const y = (v: number) => PT + (H - PT - PB) * (1 - (v - min) / range);
  const groupW = (W - PL - PR) / labels.length;
  const barW = Math.max(4, (groupW * 0.8) / series.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + range * t);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grouped bar chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
            <text x={PL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">{shortTsh(t)}</text>
          </g>
        ))}
        {labels.map((lab, i) => {
          const gx = PL + i * groupW + groupW * 0.1;
          return (
            <g key={lab + i}>
              {series.map((s, j) => {
                const v = s.values[i] ?? 0;
                const top = y(Math.max(v, 0)), bottom = y(Math.min(v, 0));
                return (
                  <rect key={s.name} x={gx + j * barW} y={top} width={barW * 0.9} height={Math.max(1, bottom - top)} fill={s.color}>
                    <title>{`${lab} · ${s.name}: TSh ${Math.round(v).toLocaleString("en-US")}`}</title>
                  </rect>
                );
              })}
              <text x={PL + i * groupW + groupW / 2} y={H - 12} textAnchor="middle" fontSize="11" fill="#475569">{lab}</text>
            </g>
          );
        })}
      </svg>
      <Legend series={series} />
    </div>
  );
}

/** Lines: one line per series over the same labels. Works with negative values (e.g. profit). */
export function Lines({ labels, series, empty }: { labels: string[]; series: SeriesDef[]; empty?: string }) {
  if (labels.length === 0 || series.every((s) => s.values.every((v) => v === 0))) {
    return <p className="empty">{empty ?? "Hakuna data ya kuonyesha kwa kipindi hiki"}</p>;
  }
  const W = 640, H = 260, PL = 56, PB = 36, PT = 12, PR = 12;
  const all = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(0, ...all));
  const min = Math.min(0, ...all);
  const range = max - min || 1;
  const y = (v: number) => PT + (H - PT - PB) * (1 - (v - min) / range);
  const x = (i: number) => (labels.length === 1 ? (W + PL - PR) / 2 : PL + (i * (W - PL - PR)) / (labels.length - 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + range * t);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
            <text x={PL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">{shortTsh(t)}</text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth="3" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.5">
                <title>{`${labels[i]} · ${s.name}: TSh ${Math.round(v).toLocaleString("en-US")}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {labels.map((lab, i) => (
          <text key={lab + i} x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill="#475569">{lab}</text>
        ))}
      </svg>
      <Legend series={series} />
    </div>
  );
}

function Legend({ series }: { series: SeriesDef[] }) {
  return (
    <ul className="legend chart-legend">
      {series.map((s) => (
        <li key={s.name}><span className="dot" style={{ background: s.color }} /><span className="lname">{s.name}</span></li>
      ))}
    </ul>
  );
}
