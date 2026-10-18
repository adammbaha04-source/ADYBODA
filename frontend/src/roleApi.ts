import { request } from "./api";
import type { PaymentRecord } from "./types";

// Manual debt / payment entries typed by the owner or manager.
export interface ManualEntry {
  id: number; vehicle: number; kind: string; day: string; amount: number; note: string;
  confirmed_at: string | null;
}

// A payment record as the backend sends it (it includes confirmed_at).
export type PaymentRow = PaymentRecord & { confirmed_at: string | null };

export const listManualEntries = (vehicleId: number) =>
  request<ManualEntry[]>("/manual-entries/").then((rows) => rows.filter((r) => r.vehicle === vehicleId));

export const confirmManualEntry = (id: number) =>
  request<ManualEntry>(`/manual-entries/${id}/confirm/`, { method: "POST" });

export const confirmPayment = (id: number) =>
  request<PaymentRow>(`/payment-records/${id}/confirm/`, { method: "POST" });
