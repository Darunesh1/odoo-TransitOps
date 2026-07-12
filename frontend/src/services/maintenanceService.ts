import api from "../api/axiosInstance";
import {
  MaintenanceCreateInput,
  MaintenanceFilters,
  MaintenanceRecord,
  MaintenanceUpdateInput,
} from "../types/maintenance";

const normalizeParams = (params?: MaintenanceFilters) => {
  if (!params) return undefined;

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  );
};

export const maintenanceService = {
  getMaintenanceLogs: async (params?: MaintenanceFilters) => {
    const response = await api.get<MaintenanceRecord[]>("/maintenance/", {
      params: normalizeParams(params),
    });
    return response.data;
  },

  getMaintenanceLog: async (id: string) => {
    const response = await api.get<MaintenanceRecord>(`/maintenance/${id}`);
    return response.data;
  },

  createMaintenanceLog: async (data: MaintenanceCreateInput) => {
    const response = await api.post<MaintenanceRecord>("/maintenance/", data);
    return response.data;
  },

  updateMaintenanceLog: async (id: string, data: MaintenanceUpdateInput) => {
    const response = await api.patch<MaintenanceRecord>(`/maintenance/${id}`, data);
    return response.data;
  },

  completeMaintenanceLog: async (id: string) => {
    const response = await api.post<MaintenanceRecord>(`/maintenance/${id}/complete`, {});
    return response.data;
  },

  cancelMaintenanceLog: async (id: string) => {
    const response = await api.post<MaintenanceRecord>(`/maintenance/${id}/cancel`, {});
    return response.data;
  },
};
