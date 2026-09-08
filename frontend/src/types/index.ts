export interface Expense {
  id: number;
  user_id: number;
  series_id?: number;
  description: string;
  amount_cents: number;
  debit_date: string;
  paid: number;
  recurring: number;
  fixed_amount: number;
  original_day: number;
  active_series: number;
  recurrence_months: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  created_at: string;
  last_login?: string;
  role?: string;
  status?: string;
}

export interface Settings {
  id: number;
  user_id: number;
  notifications_enabled: number;
  debit_notifications_enabled: number;
  debit_reminder_days: number;
  debit_reminder_hour: number;
  debit_reminder_minute: number;
  variable_reminder_enabled: number;
  variable_reminder_day: number;
  variable_reminder_hour: number;
  variable_reminder_minute: number;
  variable_snooze_minutes: number;
  tolerance: number;
  stats_window_months: number;
  terms_accepted_version: number;
  terms_accepted_at?: string;
  auto_cleanup_years?: number;
}

export interface AuthResponse {
  message: string;
  token?: string;
  user?: User;
  requiresApproval?: boolean;
  emailSent?: boolean;
}

export interface TrendDirection {
  DOWN: 'DOWN';
  STABLE: 'STABLE';
  UP: 'UP';
  UNKNOWN: 'UNKNOWN';
}

export interface Trend {
  percent: number;
  direction: TrendDirection;
}

export interface FinancialPeriod {
  start: Date;
  end: Date;
}

export type StatsComparison = 'PREVIOUS_MONTH' | 'WINDOW_AVERAGE' | 'PREVIOUS_YEAR';

export const StatsComparisonOptions = [
  { value: 'PREVIOUS_MONTH' as StatsComparison, label: 'Mês anterior' },
  { value: 'WINDOW_AVERAGE' as StatsComparison, label: 'Média dos últimos X meses' },
  { value: 'PREVIOUS_YEAR' as StatsComparison, label: 'Mesmo mês do ano anterior' }
];

export interface AccountShare {
  id: number;
  owner_id: number;
  shared_with_id: number;
  status: 'pending' | 'accepted' | 'rejected';
  can_read: number;
  can_write: number;
  can_delete: number;
  created_at: string;
  updated_at: string;
  owner_email?: string;
  shared_with_email?: string;
}

export interface SharesResponse {
  sent: AccountShare[];
  received: AccountShare[];
}
