import type { DebtEntry, DebtSummary } from "./types";

export type ExportRow = {
  vehicle: string;
  driver: string;
  s: DebtSummary;       // whole-month summary
  entries: DebtEntry[]; // every entry of the month, all weeks
};

const HEADER = ["Vehicle", "Driver", "Month", "Date", "Week", "Type", "Before", "New debt", "Paid", "After", "Notes"];

function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote anything with a comma, quote or line break. A leading = + - @ is made safe for Excel.
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * One block per vehicle: every week of the month in date order, then a MONTH TOTAL line.
 * The total line reads: Before = debt at the start of the month, New debt and Paid = sums,
 * After = debt at the end of the month. When several vehicles are exported,
 * a GRAND TOTAL line is added at the end.
 */
export function buildDebtCsv(rows: ExportRow[], month: string): string {
  const lines: string[] = [HEADER.map(cell).join(",")];
  let gBefore = 0, gNew = 0, gPaid = 0, gAfter = 0;

  for (const r of rows) {
    for (const e of r.entries) {
      lines.push([
        r.vehicle, r.driver, month, e.date, e.week_number ?? "", e.type,
        e.previous_debt, e.new_debt, e.paid_debt, e.remaining_debt, e.notes,
      ].map(cell).join(","));
    }
    lines.push([
      r.vehicle, r.driver, month, "", "", "MONTH TOTAL",
      r.s.starting_debt, r.s.debt_added, r.s.payments, r.s.ending_debt, "",
    ].map(cell).join(","));
    gBefore += r.s.starting_debt;
    gNew += r.s.debt_added;
    gPaid += r.s.payments;
    gAfter += r.s.ending_debt;
  }

  if (rows.length > 1) {
    lines.push(["ALL VEHICLES", "", month, "", "", "GRAND TOTAL", gBefore, gNew, gPaid, gAfter, ""].map(cell).join(","));
  }
  return lines.join("\r\n");
}

/** Saves text as a file. The BOM makes Excel read the file as UTF-8. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
