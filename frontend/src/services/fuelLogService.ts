import axios from 'axios';
import { FuelLog, FuelLogCreate, FuelLogUpdate } from '../types/fuelLog';

const API_BASE = (import.meta as any).VITE_API_BASE || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const fuelLogService = {
  // GET /fuel-logs/
  getFuelLogs: async (params?: {
    vehicle_id?: string;
    trip_id?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await axios.get<FuelLog[]>(`${API_BASE}/fuel-logs/`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  },

  // GET /fuel-logs/{id}
  getFuelLog: async (id: string) => {
    const response = await axios.get<FuelLog>(`${API_BASE}/fuel-logs/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // POST /fuel-logs/
  createFuelLog: async (data: FuelLogCreate) => {
    const response = await axios.post<FuelLog>(`${API_BASE}/fuel-logs/`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // PATCH /fuel-logs/{id}
  updateFuelLog: async (id: string, data: FuelLogUpdate) => {
    const response = await axios.patch<FuelLog>(`${API_BASE}/fuel-logs/${id}`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // DELETE /fuel-logs/{id}
  deleteFuelLog: async (id: string) => {
    const response = await axios.delete<FuelLog>(`${API_BASE}/fuel-logs/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },
};