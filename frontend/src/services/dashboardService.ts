import api from "../api/axiosInstance";
import { DashboardKPIs, DashboardFilters } from "../types/dashboard";

const normalizeParams = (params?: DashboardFilters) => {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  );
};

export const dashboardService = {
  getDashboardKPIs: async (params?: DashboardFilters) => {
    const response = await api.get<DashboardKPIs>("/dashboard/kpis", {
      params: normalizeParams(params),
    });
    return response.data;
  },
};
