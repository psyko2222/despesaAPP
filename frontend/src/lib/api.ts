import axios from 'axios';
import { AuthResponse, User, Expense, Settings, AccountShare, SharesResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Debug logging for POST requests
  if (config.method === 'post' && config.url?.includes('/expenses')) {
    console.log('=== DEBUG: API Request ===', {
      url: config.url,
      method: config.method,
      data: config.data,
      headers: config.headers
    });
  }
  
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  
  me: () => api.get<User>('/auth/me'),

  forgotPassword: (email: string) =>
    api.post<{ message: string; emailSent?: boolean }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>(`/auth/reset-password/${token}`, { newPassword }),

  approveByToken: (token: string) =>
    api.post<{ message: string }>(`/auth/approve/${token}`),
};

export const expensesAPI = {
  getMonth: (month: string, userId?: number) =>
    api.get<Expense[]>(`/expenses/month/${month}${userId ? `?userId=${userId}` : ''}`),
  
  getRecurring: (userId?: number) =>
    api.get<Expense[]>(`/expenses/recurring${userId ? `?userId=${userId}` : ''}`),
  
  getUpcoming: () =>
    api.get<Expense[]>('/expenses/upcoming'),
  
  getById: (id: number) =>
    api.get<Expense>(`/expenses/${id}`),
  
  getSeries: (seriesId: number, userId?: number) =>
    api.get<Expense[]>(`/expenses/series/${seriesId}${userId ? `?userId=${userId}` : ''}`),
  
  create: (expense: Partial<Expense>) =>
    api.post<Expense>('/expenses', expense),
  
  update: (id: number, expense: Partial<Expense>, userId?: number) =>
    api.put<Expense>(`/expenses/${id}${userId ? `?userId=${userId}` : ''}`, expense),
  
  updatePaid: (id: number, paid: boolean, userId?: number) =>
    api.patch<Expense>(`/expenses/${id}/paid${userId ? `?userId=${userId}` : ''}`, { paid }),
  
  delete: (id: number, wholeSeries?: boolean, userId?: number) => {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId.toString());
    if (wholeSeries !== undefined) params.append('wholeSeries', wholeSeries.toString());
    const queryString = params.toString();
    const url = `/expenses/${id}${queryString ? `?${queryString}` : ''}`;
    return api.delete(url);
  },
  
  ensureFuture: (monthsAhead: number = 18) =>
    api.post('/expenses/ensure-future', { monthsAhead }),
};

export const settingsAPI = {
  get: () =>
    api.get<Settings>('/settings'),
  
  update: (settings: Partial<Settings>) =>
    api.put<Settings>('/settings', settings),
  
  updateKey: (key: string, value: any) =>
    api.patch<Settings>(`/settings/${key}`, { value }),
};

export const backupAPI = {
  export: () =>
    api.get<any>('/backup/export'),
  
  import: (data: any) =>
    api.post('/backup/import', data),
};

export const sharesAPI = {
  invite: (email: string) =>
    api.post('/shares/invite', { email }),
  
  getInvitations: () =>
    api.get<AccountShare[]>('/shares/invitations'),
  
  acceptInvitation: (id: number) =>
    api.post(`/shares/accept/${id}`, {}),
  
  rejectInvitation: (id: number) =>
    api.post(`/shares/reject/${id}`, {}),
  
  getActiveShares: () =>
    api.get<SharesResponse>('/shares/active'),
  
  revokeShare: (id: number) =>
    api.delete(`/shares/${id}`),
  
  updatePermissions: (id: number, permissions: { can_read?: boolean; can_write?: boolean; can_delete?: boolean }) =>
    api.patch(`/shares/${id}`, permissions),
};

export const logsAPI = {
  getLogs: (params?: { limit?: number; offset?: number; level?: string; userId?: number }) =>
    api.get<any>('/logs', { params }),
  
  clearLogs: (olderThanDays?: number) =>
    api.delete<any>(`/logs/clear${olderThanDays ? `?olderThanDays=${olderThanDays}` : ''}`),
};

export default api;
