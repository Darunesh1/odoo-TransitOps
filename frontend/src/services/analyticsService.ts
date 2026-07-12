import axios from 'axios';
import { AnalyticsSummary } from '../types/analytics';

const API_BASE = (import.meta as any).VITE_API_BASE || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const analyticsService = {
  // GET /analytics/summary
  getSummary: async (params?: {
    vehicle_id?: string;
    vehicle_type?: string;
    region?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    const response = await axios.get<AnalyticsSummary>(`${API_BASE}/analytics/summary`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  },

  // GET /analytics/export (CSV)
  exportCsv: async (params?: {
    vehicle_id?: string;
    vehicle_type?: string;
    region?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    const response = await axios.get(`${API_BASE}/analytics/export`, {
      headers: getAuthHeader(),
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};