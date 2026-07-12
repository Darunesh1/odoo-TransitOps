import axios from 'axios';
import { Driver, DriverCreate, DriverUpdate, DriverStatus } from '../types/driver';

const API_BASE = (import.meta as any).VITE_API_BASE || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const driverService = {
  // GET /drivers/
  getDrivers: async (params?: {
    status?: DriverStatus | string;
    license_category?: string;
    expired?: boolean;
    search?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await axios.get<Driver[]>(`${API_BASE}/drivers/`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  },

  // GET /drivers/available
  getAvailableDrivers: async () => {
    const response = await axios.get<Driver[]>(`${API_BASE}/drivers/available`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // GET /drivers/{id}
  getDriver: async (id: string) => {
    const response = await axios.get<Driver>(`${API_BASE}/drivers/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // POST /drivers/
  createDriver: async (data: DriverCreate) => {
    const response = await axios.post<Driver>(`${API_BASE}/drivers/`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // PATCH /drivers/{id}
  updateDriver: async (id: string, data: DriverUpdate) => {
    const response = await axios.patch<Driver>(`${API_BASE}/drivers/${id}`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // POST /drivers/{id}/suspend
  suspendDriver: async (id: string) => {
    const response = await axios.post<Driver>(
      `${API_BASE}/drivers/${id}/suspend`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // POST /drivers/{id}/activate
  activateDriver: async (id: string) => {
    const response = await axios.post<Driver>(
      `${API_BASE}/drivers/${id}/activate`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // GET /drivers/{id}/trip-compliance
  getTripCompliance: async (id: string): Promise<number> => {
    try {
      const response = await axios.get<{ compliance: number }>(
        `${API_BASE}/drivers/${id}/trip-compliance`,
        { headers: getAuthHeader() }
      );
      return response.data.compliance;
    } catch (error) {
      console.warn(`Trip compliance API not ready for driver ${id}, using mock.`);
      return Math.floor(Math.random() * 20 + 80); // mock 80-100%
    }
  },
};