import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Money formatting (Portuguese)
export function formatMoney(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(euros);
}

// Date formatting (Portuguese)
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(dateObj);
}

// Financial period helpers (same logic as Android app)
export function financialPeriod(startMonth: string): { start: Date; end: Date } {
  const [year, month] = startMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 21);
  const endDate = new Date(year, month, 20); // Next month, day 20
  return { start: startDate, end: endDate };
}

export function currentFinancialPeriodMonth(date: Date = new Date()): string {
  if (date.getDate() >= 21) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  } else {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  }
}

export function adjustedDebitDate(month: string, originalDay: number): string {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  let day = Math.min(originalDay, lastDay);
  let date = new Date(year, monthNum - 1, day);
  
  // Skip weekends (Saturday = 6, Sunday = 0)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  
  return date.toISOString().split('T')[0];
}

export function normalizedRecurrenceMonths(months: number): number {
  return Math.max(1, Math.min(60, months));
}

export function recurrenceLabel(months: number): string {
  const normalized = normalizedRecurrenceMonths(months);
  switch (normalized) {
    case 1: return 'Mensal';
    case 2: return 'Bimestral';
    case 3: return 'Trimestral';
    case 6: return 'Semestral';
    case 12: return 'Anual';
    default: return `A cada ${normalized} meses`;
  }
}

// Convert cents to input string
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Parse input string to cents
export function parseCents(value: string): number | null {
  const cleaned = value.trim()
    .replace('€', '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : Math.round(parsed * 100);
}

// Trend comparison
export function compareValues(current: number, reference: number | null, tolerance: number): any {
  if (reference === null || reference === 0) {
    return { percent: 0, direction: 'UNKNOWN' };
  }
  
  const percent = ((current - reference) / reference) * 100;
  let direction: 'DOWN' | 'STABLE' | 'UP' = 'STABLE';
  
  if (percent < -tolerance) {
    direction = 'DOWN';
  } else if (percent > tolerance) {
    direction = 'UP';
  }
  
  return { percent, direction };
}

// Month navigation
export function getNextMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 1);
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getPreviousMonth(month: string, offset: number = 1): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 1);
  date.setMonth(date.getMonth() - offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Get month name in Portuguese
export function getMonthName(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 1);
  return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(date);
}

// Get financial period display with explicit dates
export function getFinancialPeriodDisplay(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const monthName = new Intl.DateTimeFormat('pt-PT', { month: 'long' }).format(new Date(year, monthNum - 1, 1));
  
  // Calculate start date (21 of previous month)
  const startDate = new Date(year, monthNum - 2, 21); // monthNum - 2 = previous month
  const startDay = startDate.getDate();
  const startMonthName = new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(startDate);
  
  // Calculate end date (20 of current month)
  const endDate = new Date(year, monthNum - 1, 20);
  const endDay = endDate.getDate();
  const endMonthName = new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(endDate);
  
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year} (${startDay} ${startMonthName} - ${endDay} ${endMonthName})`;
}

// Calculate deadline dates for payment
export function getPaymentDeadlines(month: string): { day1: Date; day20: Date } {
  const [year, monthNum] = month.split('-').map(Number);
  
  // Day 1 of NEXT month (the month after the period starts)
  const day1 = new Date(year, monthNum, 1); // monthNum = next month
  
  // Day 20 of NEXT month (following the financial cycle)
  const day20 = new Date(year, monthNum, 20); // monthNum = next month
  
  return { day1, day20 };
}

// Format amount with "sem valor" for variable expenses
export function formatAmount(amountCents: number, fixedAmount: number): string {
  if (amountCents === 0 && fixedAmount === 0) {
    return 'Sem valor';
  }
  return formatMoney(amountCents);
}
