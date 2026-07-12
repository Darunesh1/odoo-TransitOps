import api from "../api/axiosInstance";
import { Expense, ExpenseCreate, ExpenseUpdate } from '../types/expense';

export const expenseService = {
  getExpenses: async (params?: {
    vehicle_id?: string;
    trip_id?: string;
    expense_type?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await api.get<Expense[]>("/expenses/", {
      params,
    });
    return response.data;
  },

  getExpense: async (id: string) => {
    const response = await api.get<Expense>(`/expenses/${id}`);
    return response.data;
  },

  createExpense: async (data: ExpenseCreate) => {
    const response = await api.post<Expense>("/expenses/", data);
    return response.data;
  },

  updateExpense: async (id: string, data: ExpenseUpdate) => {
    const response = await api.patch<Expense>(`/expenses/${id}`, data);
    return response.data;
  },

  deleteExpense: async (id: string) => {
    const response = await api.delete<Expense>(`/expenses/${id}`);
    return response.data;
  },
};