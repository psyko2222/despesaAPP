import { useState, useEffect } from 'react';
import { authAPI } from '@/lib/api';
import { User } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await authAPI.me();
      setUser(response.data);
    } catch (err) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      setError('Session expired');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      setError(null);
      const response = await authAPI.login(email, password, rememberMe);
      
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', response.data.token);
      storage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
      throw err;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await authAPI.register(email, password);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível criar a conta');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
  };

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    checkAuth,
  };
}
