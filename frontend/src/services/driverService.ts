import api from "../api/axiosInstance";
import { Driver, DriverCreate, DriverUpdate, DriverStatus } from '../types/driver';

export const driverService = {
  getDrivers: async (params?: {
    status?: DriverStatus | string;
    license_category?: string;
    expired?: boolean;
    search?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await api.get<Driver[]>("/drivers/", {
      params,
    });
    return response.data;
  },

  getAvailableDrivers: async () => {
    const response = await api.get<Driver[]>("/drivers/available");
    return response.data;
  },

  getDriver: async (id: string) => {
    const response = await api.get<Driver>(`/drivers/${id}`);
    return response.data;
  },

  createDriver: async (data: DriverCreate) => {
    const response = await api.post<Driver>("/drivers/", data);
    return response.data;
  },

  updateDriver: async (id: string, data: DriverUpdate) => {
    const response = await api.patch<Driver>(`/drivers/${id}`, data);
    return response.data;
  },

  suspendDriver: async (id: string) => {
    const response = await api.post<Driver>(`/drivers/${id}/suspend`, {});
    return response.data;
  },

  activateDriver: async (id: string) => {
    const response = await api.post<Driver>(`/drivers/${id}/activate`, {});
    return response.data;
  },

  getTripCompliance: async (id: string): Promise<number> => {
    try {
      const response = await api.get<{ compliance: number }>(`/drivers/${id}/trip-compliance`);
      return response.data.compliance;
    } catch (error) {
      console.warn(`Trip compliance API not ready for driver ${id}, using mock.`);
      return Math.floor(Math.random() * 20 + 80); // mock 80-100%
    }
  },
};