import { addDays, shortDate, tsh } from "./format";
import type { DebtLine, IncomeRow } from "./incomeApi";
import "./income.css";

const WEEK_TYPES = ["WEEKLY_DEFICIT", "WEEKLY_EXCESS", "EXCESS_PAYMENT", "NO_CHANGE"];
const WEEK_RE = /Week (\d+): Income (\d+) vs Target (\d+)/;

// Muhtasari wa Wiki: Week | Date Range | Working Days | Target | Income | Remaining | Excess | Confirmed
export default function WeekTable(props: {
  entries: DebtLine[]; returns: IncomeRow[]; month: string; workingDays: number;
  lostDays: { week_number: number; days: number }[];
}) {
  const { entries, returns, month, workingDays: wd, lostDays } = props;

  const rows = entries
    .filter((e) => WEEK_TYPES.includes(e.type))
    .map((e) => {
      const m = e.notes.match(WEEK_RE);
      if (!m) return null;
      const week = Number(m[1]), income = Number(m[2]), target = Number(m[3]);
      const start = e.date, end = e.period_end ?? addDays(e.date, wd - 1);
      const extra = returns
        .filter((r) => r.is_excess && (r.week_number != null ? r.record_month === month && r.week_number === week
          : r.day >= start && r.day <= end))
        .reduce((a, r) => a + r.amount, 0);
      const lost = lostDays.filter((l) => l.week_number === week).reduce((a, l) => a + l.days, 0);
      return {
        week, start, end, income, target, working: Math.max(0, wd - lost),
        remaining: Math.max(0, target - income),
        excess: Math.max(0, income - target) + extra,
        confirmed: e.confirmed ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);

  return (
    <div className="scroll">
      <table className="tbl-nw">
        <thead>
          <tr><th>Week</th><th>Date Range</th><th>Working Days</th><th>Target</th><th>Income</th><th>Remaining</th><th>Excess</th><th>Confirmed</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8}>Hakuna wiki mwezi huu</td></tr>}
          {rows.map((r) => (
            <tr key={r.week}>
              <td><b>Week {r.week}</b></td>
              <td>{shortDate(r.start)} - {shortDate(r.end)}</td>
              <td className="purple">{r.working}/{wd}</td>
              <td className="blue">{tsh(r.target)}</td>
              <td className="green">{tsh(r.income)}</td>
              <td className="red">{tsh(r.remaining)}</td>
              <td className="green">{tsh(r.excess)}</td>
              <td>
                {r.confirmed === true && <span className="pill ok">Confirmed</span>}
                {r.confirmed === false && <span className="pill wait">Pending</span>}
                {r.confirmed === null && <span className="pill none">-</span>}
              </td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="total-row">
              <td><b>Jumla ({rows.length} wiki)</b></td>
              <td></td><td className="purple">{wd} days/week</td>
              <td className="blue">{tsh(sum((r) => r.target))}</td>
              <td className="green">{tsh(sum((r) => r.income))}</td>
              <td className="red">{tsh(sum((r) => r.remaining))}</td>
              <td className="green">{tsh(sum((r) => r.excess))}</td>
              <td></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
