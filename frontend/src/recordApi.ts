import { request } from "./api";

// Generic PATCH for any record endpoint (payment-records, tyre-records, insurance-records, lost-days).
export const updateRecord = <T = unknown>(path: string, id: number, data: Record<string, unknown>) =>
  request<T>(`/${path}/${id}/`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteLostDays = (id: number) =>
  request<void>(`/lost-days/${id}/`, { method: "DELETE" });

// Creates a lost-days row for the week, or updates the existing one (days + reason note).
export const saveLostDaysFull = (
  vehicleId: number,
  month: string,
  weekNumber: number,
  days: number,
  note: string,
  existingId?: number,
) => {
  if (existingId) return updateRecord("lost-days", existingId, { days, week_number: weekNumber, note });
  return request("/lost-days/", {
    method: "POST",
    body: JSON.stringify({ vehicle: vehicleId, month, week_number: weekNumber, days, note }),
  });
};
