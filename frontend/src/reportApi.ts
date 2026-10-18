import { getToken, request } from "./api";

export interface ReportTotalsV3 {
  target: number; collected: number; excess: number; new_debt: number; debt_payments: number;
  expenses: number; lost_days: number; lost_amount: number; personal: number; outstanding: number; profit: number;
  service: number; tyres: number; insurance: number; other_payments: number;
}
export interface ReportMonthV3 {
  month: string; target: number; collected: number; excess: number; new_debt: number; debt_payments: number;
  outstanding: number; expenses: number; lost_amount: number; lost_days: number; personal: number; profit: number;
  service: number; tyres: number; insurance: number; other_payments: number;
}
export interface ReportVehicleV3 {
  id: number; name: string; type: string; driver: string; working_days: number; daily_target: number;
  weekly_target: number; target: number; collected: number; excess: number; outstanding: number;
  new_debt: number; debt_payments: number; lost_days: number; lost_amount: number; service: number;
  tyres: number; insurance: number; other_payments: number; expenses: number; profit: number;
  weeks: { number: number; amount: number }[]; week_count: number;
}
export interface PersonalCategory { code: string; label: string; amount: number; }
export interface ReportV3 {
  from: string; to: string; vehicle_id: number | null; single_month: boolean;
  title: string; subtitle: string; totals: ReportTotalsV3; series: ReportMonthV3[];
  vehicles: ReportVehicleV3[]; personal_categories: PersonalCategory[];
  business_name: string; generated: string;
}

const qs = (from: string, to: string, vehicleId: string) =>
  `from=${from}&to=${to}${vehicleId && vehicleId !== "ALL" ? `&vehicle=${vehicleId}` : ""}`;

export const getReportV3 = (from: string, to: string, vehicleId: string) =>
  request<ReportV3>(`/reports/?${qs(from, to, vehicleId)}`);

// The PDF needs the login token, so it is fetched and saved as a file on the phone.
export async function downloadReportPdf(from: string, to: string, vehicleId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/reports/pdf/?${qs(from, to, vehicleId)}`, {
    headers: token ? { Authorization: `Token ${token}` } : {},
  });
  if (!res.ok) throw new Error((await res.text()) || `Hitilafu ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ripoti_${from}_${to}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
