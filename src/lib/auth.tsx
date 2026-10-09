/**
 * REDhope Authentication Context & Custom Hook
 * 
 * Provides global authentication state:
 * - currentUser: UserProfile | null
 * - token: string | null
 * - isLoading: boolean
 * - isAuthenticated: boolean
 * - login: (email, password) => Promise<UserProfile>
 * - register: (data) => Promise<UserProfile>
 * - logout: () => void
 * - refreshUser: () => Promise<void>
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getAuthToken, setAuthToken } from "./api";

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: string;
  role: "user" | "organizer" | "admin";
  dateOfBirth?: string;
  gender?: string;
  location?: {
    type?: string;
    coordinates?: [number, number];
    city?: string;
    state?: string;
    pincode?: string;
    address?: string;
  };
  isDonorAvailable: boolean;
  isEligible: boolean;
  lastDonationDate?: string | null;
  emailNotifications?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    bloodGroup: string;
  }) => Promise<UserProfile>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserInMemory: (updated: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async (authToken: string): Promise<UserProfile | null> => {
    try {
      const data = await api.get<{ success: boolean; user: UserProfile }>("/auth/me", {
        token: authToken,
      });
      if (data?.success && data.user) {
        return data.user;
      }
      return null;
    } catch (err: any) {
      if (err.statusCode === 401) {
        // Token expired or invalid
        setAuthToken(null);
        setTokenState(null);
        setUser(null);
      }
      return null;
    }
  };

  useEffect(() => {
    const savedToken = getAuthToken();
    if (savedToken) {
      setTokenState(savedToken);
      fetchCurrentUser(savedToken)
        .then((fetchedUser) => {
          setUser(fetchedUser);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const res = await api.post<{ success: boolean; token?: string; user?: UserProfile; message?: string }>(
      "/auth/login",
      { email, password }
    );

    if (res.token && res.user) {
      setAuthToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || "Login failed");
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    bloodGroup: string;
  }): Promise<UserProfile> => {
    const res = await api.post<{ success: boolean; data?: UserProfile; message?: string }>(
      "/auth/register",
      payload
    );

    // If auto-login is desired after registration, caller or user can login with credentials
    if (res.data) {
      return res.data;
    }
    throw new Error(res.message || "Registration failed");
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const currentToken = token || getAuthToken();
    if (currentToken) {
      const u = await fetchCurrentUser(currentToken);
      setUser(u);
    }
  };

  const updateUserInMemory = (updated: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...updated } : null));
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    refreshUser,
    updateUserInMemory,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

