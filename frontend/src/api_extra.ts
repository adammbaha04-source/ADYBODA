import { request } from "./api";
import type { LostDays } from "./types";

// Siku zote za hasara za magari yote kwa ombi MOJA (haraka kuliko kuuliza gari kwa gari).
export const listAllLostDays = () => request<LostDays[]>("/lost-days/");

// Kuhariri mtumiaji wa timu (manager au driver).
export const updateTeamMember = (
  id: number,
  body: {
    username?: string;
    password?: string;
    phone?: string;
    role?: "manager" | "driver";
    vehicles?: number[];
  },
) => request(`/team/${id}/`, { method: "PATCH", body: JSON.stringify(body) });
