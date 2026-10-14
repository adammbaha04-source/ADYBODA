import { monthLabel, shortDate, tsh } from "./format";
import type { DebtLine } from "./incomeApi";
import "./income.css";

function explain(e: DebtLine): string {
  const w = e.week_number ? `Wiki ${e.week_number}` : "";
  switch (e.type) {
    case "WEEKLY_DEFICIT":
      return `Deni limetokana na ${monthLabel(e.month)}, ${w}` + (e.paid_debt > 0 ? `. Limepunguzwa ${tsh(e.paid_debt)} na malipo ya ziada.` : ".");
    case "WEEKLY_EXCESS":
    case "EXCESS_PAYMENT":
      return `Ziada ya ${w} (${monthLabel(e.month)}) imepunguza deni.`;
    case "NO_CHANGE":
      return `${w} (${monthLabel(e.month)}): hakuna mabadiliko.`;
    case "MANUAL_DEBT":
      return `Deni la kuongezwa${e.notes ? ": " + e.notes : ""}`;
    case "MANUAL_PAYMENT":
      return `Malipo ya deni${e.notes ? ": " + e.notes : ""}`;
    case "CARRY_OVER":
      return "Deni la awali (carry over).";
    case "MONTH_CLOSE":
      return `Mwezi umefungwa. Deni la ${tsh(e.closed_debt)} halihamishiwi mwezi ujao (carry over imezimwa).`;
    case "DRIVER_HANDOVER":
      return e.notes;
    default:
      return e.notes;
  }
}

// Historia ya Deni: Tarehe | Wiki | Deni Kabla | Deni Jipya | Deni Iliyolipwa | Deni Baada | Maelezo | Thibitisha
export default function DebtTable({ entries }: { entries: DebtLine[] }) {
  return (
    <div className="scroll">
      <table className="tbl-nw">
        <thead>
          <tr><th>Tarehe</th><th>Wiki</th><th>Deni Kabla</th><th>Deni Jipya</th><th>Deni Iliyolipwa</th><th>Deni Baada</th><th>Maelezo</th><th>Thibitisha</th></tr>
        </thead>
        <tbody>
          {entries.length === 0 && <tr><td colSpan={8}>Hakuna rekodi za deni mwezi huu</td></tr>}
          {entries.map((e) => (
            <tr key={e.id} className={e.type === "MONTH_CLOSE" ? "row-close" : ""}>
              <td>{shortDate(e.date)}</td>
              <td>{e.week_number ?? "-"}</td>
              <td className="blue">{tsh(e.previous_debt)}</td>
              <td className="red">{e.new_debt > 0 ? "+" + tsh(e.new_debt) : tsh(0)}</td>
              <td className="green">{tsh(e.paid_debt)}</td>
              <td className="orange"><b>{tsh(e.remaining_debt)}</b></td>
              <td className="notes-wrap">{explain(e)}</td>
              <td>
                {e.confirmed === true && <span className="pill ok">Confirmed</span>}
                {e.confirmed === false && <span className="pill wait">Pending</span>}
                {(e.confirmed === null || e.confirmed === undefined) && <span className="pill none">-</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
