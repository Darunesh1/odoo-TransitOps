import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import api from "../api/axiosInstance";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
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
  fetchUserProfile: (token?: string) => Promise<void>; // optional token param
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

  // --- Axios interceptor to add token to every request ---
  useEffect(() => {
    // Add a request interceptor
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

    // Cleanup interceptor on unmount
    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, []);

  // --- Login ---
  const login = async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const res = await api.post("/auth/login", formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const { access_token, refresh_token } = res.data;
    // Store tokens immediately
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    setAccessToken(access_token);
    setRefreshToken(refresh_token);

    // Now fetch user profile – pass token directly to avoid state timing issues
    await fetchUserProfile(access_token);
  };

  // --- Register (unchanged) ---
  const register = async (full_name: string, email: string, password: string) => {
    await api.post("/auth/register", { email, password, full_name });
  };

  // --- Refresh access token ---
  const refreshAccessToken = async () => {
    if (!refreshToken) throw new Error("No refresh token available");

    const res = await api.post("/auth/refresh", { refresh_token: refreshToken });
    const { access_token } = res.data;
    localStorage.setItem("access_token", access_token);
    setAccessToken(access_token);
  };

  // --- Fetch user profile (optionally with a provided token) ---
  const fetchUserProfile = async (token?: string) => {
    try {
      const headers: any = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      // If no token is provided, rely on the interceptor (which uses localStorage)
      const res = await api.get("/users/me", { headers });
      setUser(res.data);
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      // If token is invalid, log out
      logout();
    }
  };

  // --- Logout ---
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