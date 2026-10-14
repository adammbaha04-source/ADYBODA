import { getToken } from "./api";

export interface IncomeRow {
  id: number; vehicle: number; day: string; amount: number; is_excess: boolean;
  confirmed_at: string | null; record_month: string; week_number: number | null;
  period_start: string | null; period_end: string | null; note: string;
}

export interface IncomeBody {
  day: string; amount: number; is_excess: boolean; record_month: string; week_number: number;
  period_start: string; period_end: string; note: string;
}

export interface DebtLine {
  id: string; month: string; date: string; type: string; notes: string;
  previous_debt: number; new_debt: number; paid_debt: number; closed_debt: number; remaining_debt: number;
  week_number?: number | null; confirmed?: boolean | null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Token ${token}`;
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = Object.values(JSON.parse(text)).flat().join(" "); } catch { /* keep raw text */ }
    throw new Error(msg || `Hitilafu ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const listIncome = (vehicleId: number) => call<IncomeRow[]>(`/returns/?vehicle=${vehicleId}`);
export const createIncome = (vehicleId: number, b: IncomeBody) =>
  call<IncomeRow>("/returns/", { method: "POST", body: JSON.stringify({ vehicle: vehicleId, ...b }) });
export const updateIncome = (id: number, b: IncomeBody) =>
  call<IncomeRow>(`/returns/${id}/`, { method: "PATCH", body: JSON.stringify(b) });
export const deleteIncome = (id: number) => call<void>(`/returns/${id}/`, { method: "DELETE" });
export const confirmIncome = (id: number) => call<IncomeRow>(`/returns/${id}/confirm/`, { method: "POST" });
