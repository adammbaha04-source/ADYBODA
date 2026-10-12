import type { DebtResponse, ExpenseSummary, InsuranceRecord, LostDays, PaymentRecord, PersonalExpense, ReturnRecord, ServiceRecord, TyreRecord, Vehicle } from "./types";

const TOKEN_KEY = "adybajaj_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
