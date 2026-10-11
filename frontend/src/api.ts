import type { DebtResponse, ReturnRecord, Vehicle } from "./types";

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

export const createVehicle = (name: string, dailyTarget: number, workingDaysCount: number) =>
  request<Vehicle>("/vehicles/", {
    method: "POST",
    body: JSON.stringify({ name, daily_target: dailyTarget, working_days_count: workingDaysCount }),
  });

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
