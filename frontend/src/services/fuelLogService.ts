import api from "../api/axiosInstance";
import { FuelLog, FuelLogCreate, FuelLogUpdate } from '../types/fuelLog';

export const fuelLogService = {
  getFuelLogs: async (params?: {
    vehicle_id?: string;
    trip_id?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await api.get<FuelLog[]>("/fuel-logs/", {
      params,
    });
    return response.data;
  },

  getFuelLog: async (id: string) => {
    const response = await api.get<FuelLog>(`/fuel-logs/${id}`);
    return response.data;
  },

  createFuelLog: async (data: FuelLogCreate) => {
    const response = await api.post<FuelLog>("/fuel-logs/", data);
    return response.data;
  },

  updateFuelLog: async (id: string, data: FuelLogUpdate) => {
    const response = await api.patch<FuelLog>(`/fuel-logs/${id}`, data);
    return response.data;
  },

  deleteFuelLog: async (id: string) => {
    const response = await api.delete<FuelLog>(`/fuel-logs/${id}`);
    return response.data;
  },
};