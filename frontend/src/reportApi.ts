import { getToken, request } from "./api";

export interface ReportTotalsV3 {
  target: number; collected: number; excess: number; new_debt: number; debt_payments: number;
  expenses: number; lost_days: number; theoretical_target: number; theoretical_days: number; working_days: number; lost_amount: number; personal: number; outstanding: number; profit: number;
  service: number; tyres: number; insurance: number; other_payments: number;
}
export interface ReportMonthV3 {
  month: string; target: number; collected: number; excess: number; new_debt: number; debt_payments: number;
  outstanding: number; expenses: number; lost_amount: number; lost_days: number; theoretical_target: number; theoretical_days: number; working_days: number; personal: number; profit: number;
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
export interface InsightsResponse { insights: string; model: string; }

// Hii ni interface mpya kwa ajili ya chati
export interface ChartResponse {
  chart: {
    type: "bar" | "line" | "pie" | "doughnut";
    title: string;
    labels: string[];
    datasets: { label: string; data: number[] }[];
  };
  model: string;
}

// Same base URL as request() in api.ts (VITE_API_URL, the Render backend).
const API_BASE = ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "").replace(/\/$/, "");

const qs = (from: string, to: string, vehicleId: string) =>
  `from=${from}&to=${to}${vehicleId && vehicleId !== "ALL" ? `&vehicle=${vehicleId}` : ""}`;

export const getReportV3 = (from: string, to: string, vehicleId: string) =>
  request<ReportV3>(`/reports/?${qs(from, to, vehicleId)}`);

// AI commentary on the report the app already computed. The AI only writes text; numbers are not recalculated.
export const getInsights = (report: ReportV3) =>
  request<InsightsResponse>("/ai/insights/", { method: "POST", body: JSON.stringify({ report }) });

// Hii ni function mpya ya kutuma swali kwenda kwenye AI kupata chati
export const getAIChart = (question: string, report: ReportV3) =>
  request<ChartResponse>("/ai/chart/", { 
    method: "POST", 
    body: JSON.stringify({ question, report }) 
  });

// The PDF needs the login token, so it is fetched from the backend and saved as a file on the phone.
export async function downloadReportPdf(from: string, to: string, vehicleId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/reports/pdf/?${qs(from, to, vehicleId)}&_t=${Date.now()}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Token ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text && text.length < 300 ? text : `Hitilafu ${res.status} wakati wa kutengeneza PDF.`);
  }
  // Guard against an HTML page (e.g. the frontend host answering instead of the API).
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/pdf")) {
    throw new Error("Seva haikurudisha PDF. Angalia VITE_API_URL na deploy ya backend.");
  }
  const blob = new Blob([await res.blob()], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ripoti_${from}_${to}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
