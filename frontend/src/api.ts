import type { DebtResponse, ExpenseSummary, InsuranceRecord, LostDays, PaymentRecord, PersonalExpense, ReturnRecord, ServiceRecord, TeamMember, TyreRecord, Vehicle } from "./types";

const TOKEN_KEY = "adybajaj_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Token ${token}`;
  const res = await fetch(`/api${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  if (res.status === 401) {
    clearToken();
    throw new Error("Umetoka kwenye akaunti. Ingia tena.");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Hitilafu ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(username: string, password: string): Promise<void> {
  const data = await request<{ token: string }>("/auth/token/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem(TOKEN_KEY, data.token);
}

export const listVehicles = () => request<Vehicle[]>("/vehicles/");

export const getDebt = (vehicleId: number, month: string) =>
  request<DebtResponse>(`/vehicles/${vehicleId}/debt/?month=${month}`);

export type DebtBundle = DebtResponse & { vehicle_id: number };
export const getDebtSummaries = (month: string) =>
  request<DebtBundle[]>(`/vehicles/debt-summaries/?month=${month}`);

export const setCarry = (vehicleId: number, month: string, carry: boolean) =>
  request(`/vehicles/${vehicleId}/carry/`, {
    method: "POST",
    body: JSON.stringify({ month, carry }),
  });

export const listReturns = (vehicleId: number) =>
  request<ReturnRecord[]>(`/returns/?vehicle=${vehicleId}`);

export const createReturn = (vehicleId: number, day: string, amount: number, isExcess: boolean) =>
  request<ReturnRecord>("/returns/", {
    method: "POST",
    body: JSON.stringify({ vehicle: vehicleId, day, amount, is_excess: isExcess }),
  });

export const deleteReturn = (id: number) => request<void>(`/returns/${id}/`, { method: "DELETE" });

export const createVehicle = (name: string, dailyTarget: number, workingDaysCount: number, vehicleType = "Bajaj") =>
  request<Vehicle>("/vehicles/", {
    method: "POST",
    body: JSON.stringify({ name, vehicle_type: vehicleType, daily_target: dailyTarget, working_days_count: workingDaysCount }),
  });

export const updateVehicle = (id: number, data: Partial<Vehicle>) =>
  request<Vehicle>(`/vehicles/${id}/`, { method: "PATCH", body: JSON.stringify(data) });

export const listLostDays = (vehicleId: number) =>
  request<LostDays[]>(`/lost-days/`).then((rows) => rows.filter((r) => r.vehicle === vehicleId));

export const changeDriver = (vehicleId: number, driverName: string, phone: string, fromDate: string) =>
  request("/driver-periods/", {
    method: "POST",
    body: JSON.stringify({ vehicle: vehicleId, driver_name: driverName, phone, from_date: fromDate }),
  });

export const addLostDays = (vehicleId: number, month: string, weekNumber: number, days: number) =>
  request("/lost-days/", {
    method: "POST",
    body: JSON.stringify({ vehicle: vehicleId, month, week_number: weekNumber, days }),
  });

export const addManualEntry = (vehicleId: number, kind: string, day: string, amount: number, note: string) =>
  request("/manual-entries/", {
    method: "POST",
    body: JSON.stringify({ vehicle: vehicleId, kind, day, amount, note }),
  });

export const deleteVehicle = (id: number) => request<void>(`/vehicles/${id}/`, { method: "DELETE" });

// ----- records from the old app's forms -----
export const listPayments = (vehicleId: number) => request<PaymentRecord[]>(`/payment-records/?vehicle=${vehicleId}`);
export const listServices = (vehicleId: number) => request<ServiceRecord[]>(`/service-records/?vehicle=${vehicleId}`);
export const listTyres = (vehicleId: number) => request<TyreRecord[]>(`/tyre-records/?vehicle=${vehicleId}`);
export const listInsurances = (vehicleId: number) => request<InsuranceRecord[]>(`/insurance-records/?vehicle=${vehicleId}`);

export const createPayment = (vehicleId: number, day: string, paymentType: string, amount: number, note: string) =>
  request<PaymentRecord>("/payment-records/", { method: "POST", body: JSON.stringify({ vehicle: vehicleId, day, payment_type: paymentType, amount, note }) });
export const createService = (vehicleId: number, body: { day: string; tool: string; count: number; unit_price: number; seller: string; note: string }) =>
  request<ServiceRecord>("/service-records/", { method: "POST", body: JSON.stringify({ vehicle: vehicleId, ...body }) });
export const createTyre = (vehicleId: number, day: string, tyreNumber: string, amount: number, note: string) =>
  request<TyreRecord>("/tyre-records/", { method: "POST", body: JSON.stringify({ vehicle: vehicleId, day, tyre_number: tyreNumber, amount, note }) });
export const createInsurance = (vehicleId: number, day: string, insuranceType: string, amount: number, months: number, note: string) =>
  request<InsuranceRecord>("/insurance-records/", { method: "POST", body: JSON.stringify({ vehicle: vehicleId, day, insurance_type: insuranceType, amount, months, note }) });

export const deleteRecord = (path: "payment-records" | "service-records" | "tyre-records" | "insurance-records", id: number) =>
  request<void>(`/${path}/${id}/`, { method: "DELETE" });

// ----- Matumizi tab (personal expenses, Makato, summary) -----
export const listExpenses = (month: string) => request<PersonalExpense[]>(`/personal-expenses/?month=${month}`);
export const addExpense = (day: string, category: string, amount: number, note: string) =>
  request<PersonalExpense>("/personal-expenses/", { method: "POST", body: JSON.stringify({ day, category, amount, note }) });
export const addMakato = (day: string, makatoType: string, transactionAmount: number, note: string) =>
  request<PersonalExpense>("/personal-expenses/", { method: "POST", body: JSON.stringify({ day, category: "makato", makato_type: makatoType, transaction_amount: transactionAmount, note }) });
export const deleteExpense = (id: number) => request<void>(`/personal-expenses/${id}/`, { method: "DELETE" });
export const getExpenseSummary = (month: string) => request<ExpenseSummary>(`/expense-summary/?month=${month}`);

// ----- Ripoti and Grafu -----
export interface ReportTotals {
  target: number; collected: number; excess: number; new_debt: number; debt_payments: number;
  expenses: number; lost_days: number; lost_amount: number; personal: number; outstanding: number; profit: number;
}
export interface ReportMonth {
  month: string; target: number; collected: number; excess: number; new_debt: number; debt_payments: number;
  outstanding: number; expenses: number; lost_amount: number; lost_days: number; personal: number; profit: number;
}
export interface ReportVehicle {
  id: number; name: string; type: string; driver: string; target: number; collected: number; excess: number;
  outstanding: number; new_debt: number; debt_payments: number; lost_days: number; lost_amount: number;
  service: number; expenses: number; profit: number;
}
export interface ReportData { from: string; to: string; vehicle_id: number | null; totals: ReportTotals; series: ReportMonth[]; vehicles: ReportVehicle[]; }

export const getReport = (from: string, to: string, vehicleId: string) =>
  request<ReportData>(`/reports/?from=${from}&to=${to}${vehicleId && vehicleId !== "ALL" ? `&vehicle=${vehicleId}` : ""}`);

// ----- Users (owner's team) -----
export const listTeam = () => request<TeamMember[]>("/team/");
export const createTeamMember = (body: { username: string; password: string; role: "manager" | "driver"; phone: string; vehicles: number[] }) =>
  request("/team/", { method: "POST", body: JSON.stringify(body) });
export const deleteTeamMember = (id: number) => request<void>(`/team/${id}/`, { method: "DELETE" });

// ----- Profile, settings and changamoto (clean block) -----
export interface MeProfile {
  username: string; email: string; role: string; business_owner: string;
  full_name: string; business_name: string; phone: string; avatar: string;
  theme: "light" | "dark"; background: string; accent: string;
  vehicles: { id: number; name: string }[];
}
export const getMe = () => request<MeProfile>("/me/");
export const patchMe = (data: Partial<Pick<MeProfile, "full_name" | "phone" | "avatar" | "theme" | "background" | "accent">>) =>
  request<MeProfile>("/me/", { method: "PATCH", body: JSON.stringify(data) });

export interface Challenge {
  id: number; vehicle: number; vehicle_name: string; title: string; description: string;
  status: "open" | "resolved"; created_at: string; resolved_at: string | null; created_by_name: string;
}
export const listChallenges = (status: string, vehicle: string) => {
  const q = [status !== "ALL" ? `status=${status}` : "", vehicle !== "ALL" ? `vehicle=${vehicle}` : ""].filter(Boolean).join("&");
  return request<Challenge[]>(`/challenges/${q ? "?" + q : ""}`);
};
export const createChallenge = (vehicle: number, title: string, description: string) =>
  request<Challenge>("/challenges/", { method: "POST", body: JSON.stringify({ vehicle, title, description }) });
export const solveChallenge = (id: number) => request<Challenge>(`/challenges/${id}/solve/`, { method: "POST" });

export async function registerOwner(body: { full_name: string; business_name: string; phone: string; email: string; password: string }): Promise<void> {
  const data = await request<{ token: string }>("/auth/register/", { method: "POST", body: JSON.stringify(body) });
  localStorage.setItem(TOKEN_KEY, data.token);
}


export interface WeekPlan {
  week_number: number;
  start: string;
  end: string;
  active_days: number[];
  manual_target: number | null;
  auto_target: number;
  target: number;
  lost_days: number;
  in_income_period: boolean;
  note?: string;
}

export const getWeekPlan = (vehicleId: number, month: string) =>
  request<{ month: string; weeks: WeekPlan[] }>(`/vehicles/${vehicleId}/week-plan/?month=${month}`);

export const saveWeekPlan = (
  vehicleId: number,
  body: {
    month: string; week_number: number; active_days?: number[] | null; target?: number | null;
    start_date?: string | null; end_date?: string | null; note?: string | null;
  },
) => request<{ month: string; weeks: WeekPlan[] }>(`/vehicles/${vehicleId}/week-plan/`, {
  method: "POST",
  body: JSON.stringify(body),
});
