export interface Expense {
  id: string;
  vehicle_id: string;
  trip_id?: string;
  expense_type: string;
  description?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCreate {
  vehicle_id: string;
  trip_id?: string;
  expense_type: string;
  description?: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

export type ExpenseUpdate = Partial<ExpenseCreate>;