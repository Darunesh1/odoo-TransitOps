import axios from 'axios';
import { Maintenance, MaintenanceCreate, MaintenanceUpdate, MaintenanceStatus } from '../types/maintenance';

const API_BASE = (import.meta as any).VITE_API_BASE || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const maintenanceService = {
  // GET /maintenance/
  getMaintenanceLogs: async (params?: {
    vehicle_id?: string;
    status?: MaintenanceStatus | string;
    maintenance_type?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await axios.get<Maintenance[]>(`${API_BASE}/maintenance/`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  },

  // GET /maintenance/{id}
  getMaintenanceLog: async (id: string) => {
    const response = await axios.get<Maintenance>(`${API_BASE}/maintenance/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // POST /maintenance/
  createMaintenanceLog: async (data: MaintenanceCreate) => {
    const response = await axios.post<Maintenance>(`${API_BASE}/maintenance/`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // PATCH /maintenance/{id}
  updateMaintenanceLog: async (id: string, data: MaintenanceUpdate) => {
    const response = await axios.patch<Maintenance>(`${API_BASE}/maintenance/${id}`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // POST /maintenance/{id}/complete
  completeMaintenanceLog: async (id: string) => {
    const response = await axios.post<Maintenance>(
      `${API_BASE}/maintenance/${id}/complete`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // POST /maintenance/{id}/cancel
  cancelMaintenanceLog: async (id: string) => {
    const response = await axios.post<Maintenance>(
      `${API_BASE}/maintenance/${id}/cancel`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  },
};