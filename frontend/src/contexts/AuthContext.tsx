import React, { createContext, useContext, useState, ReactNode } from "react";
import api from "../api/axiosInstance";

interface User {
  id: string;
  email: string;
  full_name: string;
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
  login: (email: string, password: string) => Promise<void>;
  register: (full_name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  fetchUserProfile: () => Promise<void>;
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

  // Login: sends form-urlencoded with username and password
  const login = async (email: string, password: string) => {
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

    // After login, fetch user profile
    await fetchUserProfile();
  };

  // Register: unchanged (JSON)
  const register = async (full_name: string, email: string, password: string) => {
    await api.post("/auth/register", { email, password, full_name });
  };

  // Refresh access token using refresh token
  const refreshAccessToken = async () => {
    if (!refreshToken) throw new Error("No refresh token available");

    const res = await api.post("/auth/refresh", { refresh_token: refreshToken });
    const { access_token } = res.data;
    localStorage.setItem("access_token", access_token);
    setAccessToken(access_token);
  };

  // Fetch user profile (GET /users/me)
  const fetchUserProfile = async () => {
    if (!accessToken) return;
    const res = await api.get("/users/me");
    setUser(res.data);
  };

  // Logout: clear all tokens and user
  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
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