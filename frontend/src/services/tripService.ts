import api from "../api/axiosInstance";
import { Trip, TripCreate, TripUpdate, TripCompleteInput, TripStatus } from '../types/trip';

export const tripService = {
  getTrips: async (params?: {
    status?: TripStatus | string;
    vehicle_id?: string;
    driver_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await api.get<Trip[]>("/trips/", {
      params,
    });
    return response.data;
  },

  getTrip: async (id: string) => {
    const response = await api.get<Trip>(`/trips/${id}`);
    return response.data;
  },

  createTrip: async (data: TripCreate) => {
    const response = await api.post<Trip>("/trips/", data);
    return response.data;
  },

  updateTrip: async (id: string, data: TripUpdate) => {
    const response = await api.patch<Trip>(`/trips/${id}`, data);
    return response.data;
  },

  dispatchTrip: async (id: string) => {
    const response = await api.post<Trip>(`/trips/${id}/dispatch`, {});
    return response.data;
  },

  completeTrip: async (id: string, data: TripCompleteInput) => {
    const response = await api.post<Trip>(`/trips/${id}/complete`, data);
    return response.data;
  },

  cancelTrip: async (id: string) => {
    const response = await api.post<Trip>(`/trips/${id}/cancel`, {});
    return response.data;
  },
};