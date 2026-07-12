import axios from 'axios';
import { Vehicle, VehicleCreate, VehicleUpdate, VehicleStatus } from '../types/vehicle';

const API_BASE = (import.meta as any).VITE_API_BASE || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const vehicleService = {
  getVehicles: async (params?: {
    status?: VehicleStatus | string;
    vehicle_type?: string;
    region?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }) => {
    try {
      const response = await axios.get<Vehicle[]>(`${API_BASE}/vehicles/`, {
        headers: getAuthHeader(),
        params,
      });
      return response.data;
    } catch (error) {
      console.error('GET /vehicles error:', error);
      throw error;
    }
  },

  getAvailableVehicles: async () => {
    const response = await axios.get<Vehicle[]>(`${API_BASE}/vehicles/available`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  getVehicle: async (id: string) => {
    const response = await axios.get<Vehicle>(`${API_BASE}/vehicles/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  createVehicle: async (data: VehicleCreate) => {
    const response = await axios.post<Vehicle>(`${API_BASE}/vehicles/`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  updateVehicle: async (id: string, data: VehicleUpdate) => {
    const response = await axios.patch<Vehicle>(`${API_BASE}/vehicles/${id}`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  retireVehicle: async (id: string) => {
    const response = await axios.post<Vehicle>(
      `${API_BASE}/vehicles/${id}/retire`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  },
};