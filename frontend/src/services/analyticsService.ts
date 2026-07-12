import api from "../api/axiosInstance";
import { AnalyticsSummary } from '../types/analytics';

export const analyticsService = {
  getSummary: async (params?: {
    vehicle_id?: string;
    vehicle_type?: string;
    region?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    const response = await api.get<AnalyticsSummary>("/analytics/summary", {
      params,
    });
    return response.data;
  },

  exportCsv: async (params?: {
    vehicle_id?: string;
    vehicle_type?: string;
    region?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    const response = await api.get("/analytics/export", {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};