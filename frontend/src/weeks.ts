// Week ranges, same rule as the backend: Monday-based; week 1 starts on the first Monday that falls inside the month.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function weekRange(month: string, week: number, workingDays: number): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const back = (new Date(y, m - 1, 1).getDay() + 6) % 7; // days since Monday
  let monday = new Date(y, m - 1, 1 - back);
  if (monday.getMonth() !== m - 1) monday = new Date(y, m - 1, 1 - back + 7);
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7 * (week - 1));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + workingDays - 1);
  return { start: ymd(start), end: ymd(end) };
}

// Which week of the month contains this date (1 if none matches).
export function weekOfDate(month: string, day: string, workingDays: number): number {
  for (let w = 1; w <= 5; w++) {
    const r = weekRange(month, w, 7);
    if (day >= r.start && day <= r.end) return w;
  }
  void workingDays;
  return 1;
}
