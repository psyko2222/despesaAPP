import axios from 'axios';
import { AuthResponse, User, Expense, Settings, AccountShare, SharesResponse, StatisticsSummaryResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
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

  login: (email: string, password: string, rememberMe: boolean = false) =>
    api.post<AuthResponse>('/auth/login', { email, password, rememberMe }),

  me: () => api.get<User>('/auth/me'),

  forgotPassword: (email: string) =>
    api.post<{ message: string; emailSent?: boolean }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>(`/auth/reset-password/${token}`, { newPassword }),

  resetPasswordDirect: (email: string, newPassword: string, confirmPassword: string) =>
    api.post<{ message: string }>('/auth/reset-password', { email, newPassword, confirmPassword }),

  approveByToken: (token: string) =>
    api.post<{ message: string }>(`/auth/approve/${token}`),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),
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

  getStatisticsSummary: (params: { month?: string; windowMonths?: number; userId?: number } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.month) searchParams.append('month', params.month);
    if (params.windowMonths) searchParams.append('windowMonths', params.windowMonths.toString());
    if (params.userId) searchParams.append('userId', params.userId.toString());
    const query = searchParams.toString();
    return api.get<StatisticsSummaryResponse>(`/expenses/statistics/summary${query ? `?${query}` : ''}`);
  },
};

export const settingsAPI = {
  get: () =>
    api.get<Settings>('/settings'),
  
  getEmailConfig: () =>
    api.get<any>('/settings/email-config'),
  
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
  
  leaveShare: (id: number) =>
    api.delete(`/shares/leave/${id}`),
  
  updatePermissions: (id: number, permissions: { can_read?: boolean; can_write?: boolean; can_delete?: boolean }) =>
    api.patch(`/shares/${id}`, permissions),
};

export const logsAPI = {
  getLogs: (params?: { limit?: number; offset?: number; level?: string; userId?: number }) =>
    api.get<any>('/logs', { params }),
  
  clearLogs: (olderThanDays?: number) =>
    api.delete<any>(`/logs/clear${olderThanDays ? `?olderThanDays=${olderThanDays}` : ''}`),
};

export const pushAPI = {
  getPublicKey: () =>
    api.get<{ publicKey: string; isConfigured: boolean }>('/push/public-key'),

  subscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }) =>
    api.post<{ success: boolean; message: string }>('/push/subscribe', subscription),

  unsubscribe: (endpoint: string) =>
    api.delete<{ success: boolean; message: string }>('/push/unsubscribe', { data: { endpoint } }),

  test: () =>
    api.post<{ success: boolean; message: string; sentCount: number }>('/push/test'),

  getStatus: () =>
    api.get<{ configured: boolean; deviceCount: number; hasActiveSubscription: boolean }>('/push/status'),
};

export const remindersAPI = {
  check: (secret?: string) =>
    api.post('/reminders/check', {}, { params: secret ? { secret } : {} }),
};

export const adminAPI = {
  getCleanupStats: (years: number) =>
    api.get<any>(`/admin/expenses/cleanup/stats?years=${years}`),

  cleanupExpenses: (years: number) =>
    api.delete<any>(`/admin/expenses/cleanup?years=${years}`),
};

export default api;

