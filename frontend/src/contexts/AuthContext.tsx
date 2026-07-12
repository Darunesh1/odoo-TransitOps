import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import api from "../api/axiosInstance";

import { UserRole } from "../types/user";

interface User {
  id: string;
  email: string;
  full_name: string;
  roles: UserRole[];
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;   // ✅ added
  loading: boolean;           // ✅ added
  login: (email: string, password: string) => Promise<void>;
  register: (full_name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  fetchUserProfile: (token?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem("access_token")
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    localStorage.getItem("refresh_token")
  );
  const [loading, setLoading] = useState(true); // ✅ added

  // ✅ computed property
  const isAuthenticated = !!accessToken;

  // Axios interceptor
  useEffect(() => {
    const interceptor = api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("access_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    return () => api.interceptors.request.eject(interceptor);
  }, []);

  // On mount, if we have a token, fetch user profile
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        await fetchUserProfile(token);
      }
      setLoading(false);
    };
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const res = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { access_token, refresh_token } = res.data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      setAccessToken(access_token);
      setRefreshToken(refresh_token);

      await fetchUserProfile(access_token);
    } finally {
      setLoading(false);
    }
  };

  const register = async (full_name: string, email: string, password: string) => {
    await api.post("/auth/register", { email, password, full_name });
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) throw new Error("No refresh token available");
    const res = await api.post("/auth/refresh", { refresh_token: refreshToken });
    const { access_token } = res.data;
    localStorage.setItem("access_token", access_token);
    setAccessToken(access_token);
  };

  const fetchUserProfile = async (token?: string) => {
    try {
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await api.get("/users/me", { headers });
      const userData = res.data;
      const validRoles = Array.isArray(userData.roles) ? userData.roles : [];
      setUser({ ...userData, roles: validRoles });
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
        refreshAccessToken,
        fetchUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};