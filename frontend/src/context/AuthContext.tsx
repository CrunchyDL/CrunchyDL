import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: number | string;
  username: string;
  role: string;
  must_change_password?: boolean | number;
  bio?: string;
  avatar_url?: string;
  full_name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (newPassword: string) => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  isLoading: boolean;
  isAdmin: boolean;
  isContributor: boolean;
  mustChangePassword: boolean;
  needsSetup: boolean; // New
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false); // New

  const API_BASE = '/api';

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Check if setup is needed
        const setupResp = await axios.get(`${API_BASE}/setup/status`);
        if (setupResp.data && setupResp.data.installed === false) {
          setNeedsSetup(true);
          setIsLoading(false);
          return;
        }

        const savedToken = localStorage.getItem('token');
        if (savedToken) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
          const response = await axios.get(`${API_BASE}/auth/me`);
          setUser(response.data.user);
        }
      } catch (error: any) {
        const status = error.response?.status;
        if (status === 418) {
          setNeedsSetup(true);
        } else if (status === 401 || status === 403) {
          // Normal: User is not logged in or token expired
          logout();
        } else {
          console.error('Auth initialization failed:', error);
          logout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { username, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (newPassword: string) => {
    try {
      await axios.post(`${API_BASE}/auth/change-password`, { newPassword });
      if (user) {
        setUser({ ...user, must_change_password: false });
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...data });
    }
  };

  const isAdmin = user?.role === 'admin';
  const isContributor = user?.role === 'admin' || user?.role === 'contributor';
  const mustChangePassword = !!user?.must_change_password;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, changePassword, updateUser, isLoading, isAdmin, isContributor, mustChangePassword, needsSetup }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
