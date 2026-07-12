import axios from 'axios';
import { Expense, ExpenseCreate, ExpenseUpdate } from '../types/expense';

const API_BASE = (import.meta as any).VITE_API_BASE || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const expenseService = {
  // GET /expenses/
  getExpenses: async (params?: {
    vehicle_id?: string;
    trip_id?: string;
    expense_type?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await axios.get<Expense[]>(`${API_BASE}/expenses/`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  },

  // GET /expenses/{id}
  getExpense: async (id: string) => {
    const response = await axios.get<Expense>(`${API_BASE}/expenses/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // POST /expenses/
  createExpense: async (data: ExpenseCreate) => {
    const response = await axios.post<Expense>(`${API_BASE}/expenses/`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // PATCH /expenses/{id}
  updateExpense: async (id: string, data: ExpenseUpdate) => {
    const response = await axios.patch<Expense>(`${API_BASE}/expenses/${id}`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // DELETE /expenses/{id}
  deleteExpense: async (id: string) => {
    const response = await axios.delete<Expense>(`${API_BASE}/expenses/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },
};