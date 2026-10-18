// Roles and the menu each role can see.
// owner: everything. manager: only the vehicles assigned to him. driver: only his own vehicle, view only.
export type Role = "owner" | "manager" | "driver";

export type View =
  | "vehicles" | "income" | "service" | "debt" | "changamoto" | "ripoti"
  | "grafu" | "users" | "profile" | "settings" | "manage";

export interface MenuItem { key: View; label: string; icon: string; }

export const MENU: MenuItem[] = [
  { key: "vehicles", label: "Vehicles", icon: "🚗" },
  { key: "income", label: "Matumizi", icon: "💵" },
  { key: "service", label: "Service", icon: "🔧" },
  { key: "debt", label: "Deni", icon: "📉" },
  { key: "changamoto", label: "Changamoto", icon: "⚠️" },
  { key: "ripoti", label: "Ripoti", icon: "📊" },
  { key: "grafu", label: "Grafu", icon: "📈" },
  { key: "users", label: "Users", icon: "👥" },
  { key: "profile", label: "Profile", icon: "👤" },
  { key: "settings", label: "Settings", icon: "⚙️" },
  { key: "manage", label: "Usimamizi", icon: "🛠️" },
];

const ALLOWED: Record<Role, View[]> = {
  owner: MENU.map((m) => m.key),
  manager: ["vehicles", "service", "changamoto", "profile", "settings"],
  driver: ["vehicles", "changamoto", "profile", "settings"],
};

export const ROLE_NAME: Record<Role, string> = { owner: "OWNER", manager: "MANAGER", driver: "DRIVER" };

export function asRole(value: string | null | undefined): Role {
  return value === "manager" || value === "driver" ? value : "owner";
}

export function menuFor(role: Role): MenuItem[] {
  return MENU.filter((m) => ALLOWED[role].includes(m.key));
}

export function canOpen(role: Role, view: View): boolean {
  return ALLOWED[role].includes(view);
}
