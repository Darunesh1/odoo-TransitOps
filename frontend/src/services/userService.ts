import api from "../api/axiosInstance";
import {
  UserFilters,
  UserRead,
  UserCreate,
  AdminUserUpdate,
  UserRole,
} from "../types/user";

const normalizeParams = (params?: UserFilters) => {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  );
};

export const userService = {
  getUsers: async (filters?: UserFilters) => {
    const response = await api.get<UserRead[]>("/users/", {
      params: normalizeParams(filters),
    });
    return response.data;
  },

  getUser: async (id: string) => {
    const response = await api.get<UserRead>(`/users/${id}`);
    return response.data;
  },

  createUser: async (data: UserCreate) => {
    const response = await api.post<UserRead>("/users/", data);
    return response.data;
  },

  updateUser: async (id: string, data: AdminUserUpdate) => {
    const response = await api.patch<UserRead>(`/users/${id}`, data);
    return response.data;
  },

  activateUser: async (id: string) => {
    const response = await api.post<UserRead>(`/users/${id}/activate`, {});
    return response.data;
  },

  deactivateUser: async (id: string) => {
    const response = await api.post<UserRead>(`/users/${id}/deactivate`, {});
    return response.data;
  },

  addUserRoles: async (id: string, roles: UserRole[]) => {
    const response = await api.post<UserRead>(`/users/${id}/roles`, { roles });
    return response.data;
  },

  removeUserRole: async (id: string, role: UserRole) => {
    const response = await api.delete<UserRead>(`/users/${id}/roles/${role}`);
    return response.data;
  },
};
