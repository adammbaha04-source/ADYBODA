export interface DriverPeriod {
  id: number;
  driver_name: string;
  phone: string;
  from_date: string;
}

export interface Vehicle {
  id: number;
  name: string;
  vehicle_type: string;
  daily_target: number;
  working_days_count: number;
  include_week5: boolean;
  no_carry_months: string[];
  driver_periods: DriverPeriod[];
}

export interface DebtSummary {
  month: string;
  starting_debt: number;
  debt_added: number;
  payments: number;
  closed_debt: number;
  ending_debt: number;
  weekly_target: number;
  carry_over_on: boolean;
}

export interface DebtEntry {
  id: string;
  month: string;
  date: string;
  type: string;
  notes: string;
  previous_debt: number;
  new_debt: number;
  paid_debt: number;
  closed_debt: number;
  remaining_debt: number;
}

export interface ReturnRecord {
  id: number;
  vehicle: number;
  day: string;
  amount: number;
  is_excess: boolean;
}

export interface DebtResponse {
  summary: DebtSummary;
  entries: DebtEntry[];
}

export interface LostDays {
  id: number;
  vehicle: number;
  month: string;
  week_number: number;
  days: number;
}

export interface PaymentRecord { id: number; day: string; payment_type: string; amount: number; note: string; }
export interface ServiceRecord { id: number; day: string; tool: string; count: number; unit_price: number; seller: string; note: string; total: number; }
export interface TyreRecord { id: number; day: string; tyre_number: string; amount: number; note: string; }
export interface InsuranceRecord { id: number; day: string; insurance_type: string; amount: number; months: number; note: string; }

export interface PersonalExpense { id: number; day: string; category: string; amount: number; note: string; makato_type: string; transaction_amount: number | null; }
export interface ExpenseSummary {
  month: string;
  categories: Record<string, number>;
  vehicle: { service: number; tairi: number; bima: number; deni: number; malipo: number };
  total_personal: number;
}

export interface TeamMember {
  id: number;
  username: string;
  role: "manager" | "driver";
  phone: string;
  vehicles: { id: number; name: string }[];
}
