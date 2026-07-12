import api from "../api/axiosInstance";
import { Vehicle, VehicleCreate, VehicleUpdate, VehicleStatus } from '../types/vehicle';

export const vehicleService = {
  getVehicles: async (params?: {
    status?: VehicleStatus | string;
    vehicle_type?: string;
    region?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await api.get<Vehicle[]>("/vehicles/", {
      params,
    });
    return response.data;
  },

  getAvailableVehicles: async () => {
    const response = await api.get<Vehicle[]>("/vehicles/available");
    return response.data;
  },

  getVehicle: async (id: string) => {
    const response = await api.get<Vehicle>(`/vehicles/${id}`);
    return response.data;
  },

  createVehicle: async (data: VehicleCreate) => {
    const response = await api.post<Vehicle>("/vehicles/", data);
    return response.data;
  },

  updateVehicle: async (id: string, data: VehicleUpdate) => {
    const response = await api.patch<Vehicle>(`/vehicles/${id}`, data);
    return response.data;
  },

  retireVehicle: async (id: string) => {
    const response = await api.post<Vehicle>(`/vehicles/${id}/retire`, {});
    return response.data;
  },
};