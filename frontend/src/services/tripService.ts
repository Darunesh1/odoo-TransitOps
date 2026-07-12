import axios from 'axios';
import { Trip, TripCreate, TripUpdate, TripCompleteInput, TripStatus } from '../types/trip';

const API_BASE = (import.meta as any).VITE_API_BASE || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const tripService = {
  // GET /trips/
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
    const response = await axios.get<Trip[]>(`${API_BASE}/trips/`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data;
  },

  // GET /trips/{id}
  getTrip: async (id: string) => {
    const response = await axios.get<Trip>(`${API_BASE}/trips/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // POST /trips/
  createTrip: async (data: TripCreate) => {
    const response = await axios.post<Trip>(`${API_BASE}/trips/`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // PATCH /trips/{id}
  updateTrip: async (id: string, data: TripUpdate) => {
    const response = await axios.patch<Trip>(`${API_BASE}/trips/${id}`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  },

  // POST /trips/{id}/dispatch
  dispatchTrip: async (id: string) => {
    const response = await axios.post<Trip>(
      `${API_BASE}/trips/${id}/dispatch`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // POST /trips/{id}/complete
  completeTrip: async (id: string, data: TripCompleteInput) => {
    const response = await axios.post<Trip>(
      `${API_BASE}/trips/${id}/complete`,
      data,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  // POST /trips/{id}/cancel
  cancelTrip: async (id: string) => {
    const response = await axios.post<Trip>(
      `${API_BASE}/trips/${id}/cancel`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  },
};