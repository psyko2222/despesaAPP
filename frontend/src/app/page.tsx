'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Home, Repeat, BarChart3, Settings, Users, Plus, Trash2, Edit, CheckCircle2, Circle, Search, Calendar, AlertTriangle, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExpenseForm } from '@/components/ExpenseForm';
import { StatisticsScreen } from '@/components/StatisticsScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { SharesScreen } from '@/components/SharesScreen';
import { AdminPanel } from '@/components/AdminPanel';
import { useToast } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { BottomNav, Tab } from '@/components/BottomNav';
import { MonthPickerModal } from '@/components/MonthPickerModal';
import { formatMoney, formatDate, currentFinancialPeriodMonth, getNextMonth, getPreviousMonth, getFinancialPeriodDisplay, recurrenceLabel, getPaymentDeadlines, financialPeriod, formatAmount } from '@/lib/utils';
import { expensesAPI, sharesAPI } from '@/lib/api';
import { Expense, AccountShare } from '@/types';

type FilterStatus = 'all' | 'unpaid' | 'no_value' | 'paid';

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('month');
  const [currentMonth, setCurrentMonth] = useState(currentFinancialPeriodMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [sharedAccounts, setSharedAccounts] = useState<AccountShare[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<{id: number, email: string, permissions?: {can_write: boolean, can_delete: boolean}} | null>(null);

  // Novos estados para filtros, pesquisa, seletor de mês e confirmação
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [showDeadlines, setShowDeadlines] = useState(false);

  // Totais e prazos calculados de forma reativa
  const totalExpenses = useMemo(() => expenses.reduce((sum, exp) => sum + exp.amount_cents, 0), [expenses]);
  const totalUnpaid = useMemo(() => expenses.filter(exp => !exp.paid).reduce((sum, exp) => sum + exp.amount_cents, 0), [expenses]);

  const day1Info = useMemo(() => {
    const day1Expenses = expenses.filter(exp => {
      if (exp.paid) return false;
      const expDate = new Date(exp.debit_date);
      const deadline = getPaymentDeadlines(currentMonth).day1;
      const period = financialPeriod(currentMonth);
      const isInPeriod = expDate >= period.start && expDate <= period.end;
      return isInPeriod && expDate <= deadline;
    });
    const total = day1Expenses.reduce((sum, exp) => sum + exp.amount_cents, 0);
    const hasNoValue = day1Expenses.some(exp => exp.amount_cents === 0 && exp.fixed_amount === 0);
    return { total, hasNoValue };
  }, [expenses, currentMonth]);

  const day20Info = useMemo(() => {
    const day20Expenses = expenses.filter(exp => {
      if (exp.paid) return false;
      const expDate = new Date(exp.debit_date);
      const deadline = getPaymentDeadlines(currentMonth).day20;
      const period = financialPeriod(currentMonth);
      const isInPeriod = expDate >= period.start && expDate <= period.end;
      return isInPeriod && expDate <= deadline;
    });
    const total = day20Expenses.reduce((sum, exp) => sum + exp.amount_cents, 0);
    const hasNoValue = day20Expenses.some(exp => exp.amount_cents === 0 && exp.fixed_amount === 0);
    return { total, hasNoValue };
  }, [expenses, currentMonth]);

  // Despesas filtradas por estado e pesquisa de texto
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      // 1. Filtrar por estado
      if (filterStatus === 'unpaid' && expense.paid) return false;
      if (filterStatus === 'paid' && !expense.paid) return false;
      if (filterStatus === 'no_value' && (expense.amount_cents !== 0 && expense.amount_cents !== null)) return false;

      // 2. Filtrar por pesquisa de texto
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return expense.description.toLowerCase().includes(query);
      }

      return true;
    });
  }, [expenses, filterStatus, searchQuery]);

  // Load saved account selection from localStorage
  useEffect(() => {
    const savedAccountId = localStorage.getItem('selectedAccountId');
    const savedAccountEmail = localStorage.getItem('selectedAccountEmail');
    if (savedAccountId && savedAccountEmail) {
      setSelectedAccount({
        id: parseInt(savedAccountId),
        email: savedAccountEmail,
        permissions: { can_write: true, can_delete: true } // Default permissions, will be updated when accounts load
      });
    }
  }, []);

  // Save account selection to localStorage when it changes
  useEffect(() => {
    if (selectedAccount) {
      localStorage.setItem('selectedAccountId', selectedAccount.id.toString());
      localStorage.setItem('selectedAccountEmail', selectedAccount.email);
    } else {
      localStorage.removeItem('selectedAccountId');
      localStorage.removeItem('selectedAccountEmail');
    }
  }, [selectedAccount?.id, selectedAccount?.email]);

  // Update permissions when shared accounts load
  useEffect(() => {
    if (selectedAccount && sharedAccounts.length > 0) {
      const account = sharedAccounts.find((a: AccountShare) => a.owner_id === selectedAccount.id);
      if (!account) {
        // Saved account no longer exists in shared accounts, clear selection
        setSelectedAccount(null);
      }
    }
  }, [sharedAccounts]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadExpenses();
      checkInvitations();
      loadSharedAccounts();
    }
  }, [user, currentMonth, selectedAccount]);

  const loadExpenses = async () => {
    setLoadingExpenses(true);
    try {
      const targetUserId = selectedAccount?.id;
      const [monthData, recurringData] = await Promise.all([
        expensesAPI.getMonth(currentMonth, targetUserId),
        expensesAPI.getRecurring(targetUserId)
      ]);
      setExpenses(monthData.data);
      setRecurringExpenses(recurringData.data);
    } catch (error) {
      console.error('Failed to load expenses:', error);
      // If there's an error loading shared data, fall back to own data
      if (selectedAccount) {
        console.log('Falling back to own data');
        setSelectedAccount(null);
        loadExpenses();
      }
    } finally {
      setLoadingExpenses(false);
    }
  };

  const checkInvitations = async () => {
    try {
      const response = await sharesAPI.getInvitations();
      setPendingInvitations(response.data.length);
    } catch (error) {
      console.error('Failed to check invitations:', error);
    }
  };

  const loadSharedAccounts = async () => {
    try {
      const response = await sharesAPI.getActiveShares();
      const receivedAccounts = response.data.received || [];
      setSharedAccounts(receivedAccounts);
    } catch (error) {
      console.error('Failed to load shared accounts:', error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleTogglePaidQuick = async (e: React.MouseEvent, expense: Expense) => {
    e.stopPropagation();
    if (selectedAccount !== null && !selectedAccount.permissions?.can_write) return;

    const newPaid = expense.paid === 1 ? 0 : 1;
    // Optimistic UI update
    setExpenses(prev => prev.map(item => item.id === expense.id ? { ...item, paid: newPaid } : item));

    try {
      await expensesAPI.updatePaid(expense.id, newPaid === 1, selectedAccount?.id);
      toast.success(newPaid === 1 ? `"${expense.description}" marcada como paga!` : `"${expense.description}" marcada como não paga.`);
    } catch (error) {
      console.error('Failed to update paid status:', error);
      setExpenses(prev => prev.map(item => item.id === expense.id ? { ...item, paid: expense.paid } : item));
      toast.error('Erro ao atualizar estado da despesa');
    }
  };

  const handleDeleteExpense = (expense: Expense) => {
    setExpenseToDelete(expense);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    const exp = expenseToDelete;
    setExpenseToDelete(null);

    try {
      await expensesAPI.delete(exp.id, exp.recurring === 1, selectedAccount?.id);
      setSelectedExpense(null);
      toast.success(`"${exp.description}" apagada com sucesso.`);
      loadExpenses();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error('Erro ao apagar despesa.');
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(null);
    setEditingExpense(expense);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">A carregar...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const tabs = [
    { id: 'month' as Tab, label: 'Mês', icon: Home },
    { id: 'regular' as Tab, label: 'Regulares', icon: Repeat },
    { id: 'stats' as Tab, label: 'Estatísticas', icon: BarChart3 },
    { id: 'shares' as Tab, label: 'Partilhas', icon: Users },
    { id: 'settings' as Tab, label: 'Definições', icon: Settings },
    ...(user?.role === 'admin' ? [{ id: 'admin' as Tab, label: 'Admin', icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <img src="/icon-192.png" alt="Despesas" className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg" />
            <h1 className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">Despesas</h1>
            {sharedAccounts.length > 0 && (
              <select
                value={selectedAccount?.id?.toString() || 'own'}
                onChange={(e) => {
                  if (e.target.value === 'own') {
                    setSelectedAccount(null);
                  } else {
                    const account = sharedAccounts.find((a: AccountShare) => a.owner_id === parseInt(e.target.value));
                    setSelectedAccount(account ? { 
                      id: account.owner_id, 
                      email: account.owner_email || '',
                      permissions: {
                        can_write: account.can_write === 1,
                        can_delete: account.can_delete === 1
                      }
                    } : null);
                  }
                }}
                className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-2 py-1 text-xs sm:text-sm max-w-[120px] sm:max-w-none"
              >
                <option value="own">Minha Conta</option>
                {sharedAccounts.map((account: AccountShare) => (
                  <option key={account.id} value={account.owner_id.toString()}>
                    {account.owner_email}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-sm sm:text-base">
            Sair
          </Button>
        </div>
      </header>

      {/* Navigation Tabs - Desktop e Tablets (Oculto em telemóveis pois usam a barra inferior) */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-14 sm:top-16 z-10 hidden sm:block">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap relative text-xs sm:text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-semibold'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.id === 'shares' && pendingInvitations > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                      {pendingInvitations}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content - com padding seguro para não sobrepor botões virtuais Android */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28 sm:pb-8">
        {activeTab === 'month' && (
          <div>
            {/* Month Navigation com Seletor Direto de Mês */}
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentMonth(getPreviousMonth(currentMonth))}
                className="text-xs sm:text-sm px-2.5 sm:px-4"
              >
                ← Ant
              </Button>
              
              <button
                type="button"
                onClick={() => setShowMonthPicker(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                title="Tocar para escolher qualquer mês diretamente"
              >
                <h2 className="text-sm sm:text-xl font-bold text-center text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {getFinancialPeriodDisplay(currentMonth)}
                </h2>
                <Calendar className="w-4 h-4 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex-shrink-0" />
              </button>

              <Button
                variant="outline"
                onClick={() => setCurrentMonth(getNextMonth(currentMonth))}
                className="text-xs sm:text-sm px-2.5 sm:px-4"
              >
                Seg →
              </Button>
            </div>

            {/* Resumo do Mês - Versão Mobile Compacta (sm:hidden) */}
            <div className="sm:hidden mb-4">
              <div className="grid grid-cols-2 gap-2">
                {/* Total */}
                <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 shadow-xs">
                  <span className="text-[10px] font-bold text-blue-900/70 dark:text-blue-300/70 uppercase tracking-wider block">
                    Total
                  </span>
                  <span className="text-base font-bold text-blue-700 dark:text-blue-400 block truncate mt-0.5">
                    {formatMoney(totalExpenses)}
                  </span>
                </div>

                {/* Por Pagar */}
                <div className="p-2.5 rounded-xl bg-red-50/80 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 shadow-xs">
                  <span className="text-[10px] font-bold text-red-900/70 dark:text-red-300/70 uppercase tracking-wider block">
                    Por Pagar
                  </span>
                  <span className="text-base font-bold text-red-600 dark:text-red-400 block truncate mt-0.5">
                    {formatMoney(totalUnpaid)}
                  </span>
                </div>
              </div>

              {/* Botão retrátil para Prazos dia 1 e 20 */}
              <button
                type="button"
                onClick={() => setShowDeadlines(!showDeadlines)}
                className="w-full mt-2 flex items-center justify-between px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors shadow-xs"
              >
                <span className="font-medium flex items-center gap-1.5 text-[11px]">
                  <span>Prazos (dia 1 e 20)</span>
                  {!showDeadlines && totalUnpaid > 0 && (
                    <span className="text-gray-400 dark:text-gray-500">
                      • d1: {formatMoney(day1Info.total)}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 flex items-center gap-0.5">
                  {showDeadlines ? 'Ocultar' : 'Ver prazos'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showDeadlines ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {/* Detalhe dos prazos (visível ao expandir) */}
              {showDeadlines && (
                <div className="grid grid-cols-2 gap-2 mt-2 animate-in fade-in duration-150">
                  <div className="p-2 rounded-lg bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-900/60 shadow-xs">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block uppercase">
                      Até dia 1
                    </span>
                    <span className="font-bold text-xs text-orange-600 dark:text-orange-400 mt-0.5 block">
                      {formatMoney(day1Info.total)}{day1Info.hasNoValue && <span className="ml-0.5">*</span>}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-900/60 shadow-xs">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block uppercase">
                      Até dia 20
                    </span>
                    <span className="font-bold text-xs text-orange-600 dark:text-orange-400 mt-0.5 block">
                      {formatMoney(day20Info.total)}{day20Info.hasNoValue && <span className="ml-0.5">*</span>}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Resumo do Mês - Versão Desktop e Tablet (hidden sm:block) */}
            <div className="hidden sm:block">
              <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-200 dark:border-blue-900/60">
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold mb-3 text-blue-900 dark:text-blue-200">Resumo do Mês</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-white/70 dark:bg-gray-900/50 border border-blue-100 dark:border-blue-900/40">
                      <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Total em despesas</span>
                      <span className="font-bold text-xl text-blue-700 dark:text-blue-400 block">
                        {formatMoney(totalExpenses)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/70 dark:bg-gray-900/50 border border-red-100 dark:border-red-900/40">
                      <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Total não pago</span>
                      <span className="font-bold text-xl text-red-600 dark:text-red-400 block">
                        {formatMoney(totalUnpaid)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/70 dark:bg-gray-900/50 border border-orange-100 dark:border-orange-900/40">
                      <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Falta pagar até dia 1</span>
                      <span className="font-bold text-xl text-orange-600 dark:text-orange-400 block">
                        {formatMoney(day1Info.total)}{day1Info.hasNoValue && <span className="ml-0.5">*</span>}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/70 dark:bg-gray-900/50 border border-orange-100 dark:border-orange-900/40">
                      <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Falta pagar até dia 20</span>
                      <span className="font-bold text-xl text-orange-600 dark:text-orange-400 block">
                        {formatMoney(day20Info.total)}{day20Info.hasNoValue && <span className="ml-0.5">*</span>}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alerta de Despesas Sem Valor */}
            {(() => {
              const noValCount = expenses.filter(e => (e.amount_cents === 0 || e.amount_cents === null)).length;
              if (noValCount === 0 || filterStatus === 'no_value') return null;

              return (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 rounded-xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>
                      Tens <strong>{noValCount}</strong> {noValCount === 1 ? 'despesa sem valor' : 'despesas sem valor'} neste período.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('no_value')}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-200/90 dark:bg-amber-900/60 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 transition-colors flex-shrink-0"
                  >
                    Ver despesas
                  </button>
                </div>
              );
            })()}

            {/* Add Expense Button */}
            <div className="mb-4 sm:mb-6">
              <Button
                onClick={() => setShowForm(true)}
                className="w-full text-sm sm:text-base font-semibold shadow-sm"
                disabled={selectedAccount !== null && !selectedAccount.permissions?.can_write}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Despesa
              </Button>
              {selectedAccount && !selectedAccount.permissions?.can_write && (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                  Não tem permissão para adicionar despesas a esta conta
                </p>
              )}
            </div>

            {/* Barra de Pesquisa e Filtros Rápidos */}
            <div className="space-y-3 mb-4">
              {/* Barra de pesquisa */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Pesquisar por descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Chips de filtro */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all' as FilterStatus, label: 'Todas', count: expenses.length },
                  { id: 'unpaid' as FilterStatus, label: 'Por Pagar', count: expenses.filter(e => !e.paid).length },
                  { id: 'no_value' as FilterStatus, label: 'Sem Valor', count: expenses.filter(e => (e.amount_cents === 0 || e.amount_cents === null)).length, highlight: true },
                  { id: 'paid' as FilterStatus, label: 'Pagas', count: expenses.filter(e => e.paid === 1).length },
                ].map((chip) => {
                  const isActive = filterStatus === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilterStatus(chip.id)}
                      className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-sm'
                          : chip.highlight && chip.count > 0
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span>{chip.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}>
                        {chip.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Expenses List */}
            {loadingExpenses ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm sm:text-base">A carregar despesas...</p>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                  {expenses.length === 0 ? 'Sem despesas neste período' : 'Nenhuma despesa encontrada com os filtros selecionados'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {filteredExpenses.map((expense) => {
                  // Check if expense has no value (variable expense not yet filled)
                  const hasNoValue = expense.amount_cents === 0 && expense.fixed_amount === 0;

                  // Check if expense is unpaid and due by day 1
                  const isDueByDay1 = !expense.paid && (() => {
                    const expDate = new Date(expense.debit_date);
                    const deadline = getPaymentDeadlines(currentMonth).day1;
                    const period = financialPeriod(currentMonth);
                    const isInPeriod = expDate >= period.start && expDate <= period.end;
                    return isInPeriod && expDate <= deadline;
                  })();

                  // Check if expense is unpaid and due by day 20 (but not by day 1)
                  const isDueByDay20 = !expense.paid && (() => {
                    const expDate = new Date(expense.debit_date);
                    const day1Deadline = getPaymentDeadlines(currentMonth).day1;
                    const day20Deadline = getPaymentDeadlines(currentMonth).day20;
                    const period = financialPeriod(currentMonth);
                    const isInPeriod = expDate >= period.start && expDate <= period.end;
                    // Due by day 20 but NOT by day 1
                    return isInPeriod && expDate <= day20Deadline && expDate > day1Deadline;
                  })();

                  return (
                    <Card
                      key={expense.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        hasNoValue 
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' 
                          : expense.paid 
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                            : 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                      }`}
                      onClick={() => setSelectedExpense(expense)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-3">
                          {/* Botão de Pagar com 1 Clique (Apenas Mobile) */}
                          <button
                            type="button"
                            onClick={(e) => handleTogglePaidQuick(e, expense)}
                            disabled={selectedAccount !== null && !selectedAccount.permissions?.can_write}
                            className="sm:hidden p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-transform active:scale-90 flex-shrink-0"
                            title={expense.paid ? "Marcar como não pago" : "Marcar como pago"}
                          >
                            {expense.paid ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950/60" />
                            ) : (
                              <Circle className="w-6 h-6 text-gray-400 dark:text-gray-500 hover:text-primary-500" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">
                              {expense.description}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(expense.debit_date)}
                            </p>
                            {expense.recurring && (
                              <span className="inline-block mt-1 text-[11px] bg-primary-100 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded font-medium">
                                {recurrenceLabel(expense.recurrence_months)}
                              </span>
                            )}
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">
                              {formatAmount(expense.amount_cents, expense.fixed_amount)}
                              {hasNoValue && !expense.paid && (isDueByDay1 || isDueByDay20) && (
                                <span className="text-amber-600 dark:text-amber-400 ml-1 font-bold">*</span>
                              )}
                            </p>
                            {hasNoValue ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                Sem valor
                              </span>
                            ) : expense.paid ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                Pago
                              </span>
                            ) : (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300">
                                Não pago
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'regular' && (
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">
              Despesas Regulares - {getFinancialPeriodDisplay(currentMonth)}
            </h2>
            {recurringExpenses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                  Sem despesas regulares
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {recurringExpenses.map((expense) => {
                  // Check if expense has no value (variable expense not yet filled)
                  const hasNoValue = expense.amount_cents === 0 && expense.fixed_amount === 0;

                  return (
                    <Card
                      key={expense.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        hasNoValue 
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' 
                          : expense.paid 
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                            : 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                      }`}
                      onClick={() => setSelectedExpense(expense)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">{expense.description}</h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              Próximo débito: {formatDate(expense.debit_date)}
                            </p>
                            <span className="inline-block mt-1 text-[11px] bg-primary-100 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded font-medium">
                              {recurrenceLabel(expense.recurrence_months)}
                            </span>
                          </div>
                          <div className="text-right ml-2 sm:ml-4">
                            <p className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">
                              {formatAmount(expense.amount_cents, expense.fixed_amount)}
                            </p>
                            {hasNoValue ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">Sem valor</span>
                            ) : expense.paid ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">Pago</span>
                            ) : (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300">Não pago</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <StatisticsScreen userId={selectedAccount?.id} />
        )}

        {activeTab === 'shares' && (
          <SharesScreen />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen />
        )}

        {activeTab === 'admin' && (
          <AdminPanel />
        )}
      </main>

      {/* Footer com data e hora de publicação */}
      <footer className="py-4 text-center text-xs text-gray-400 select-none">
        Publicação: {process.env.NEXT_PUBLIC_BUILD_TIME || 'Desenvolvimento'}
      </footer>

      {/* Expense Form Modal */}
      {showForm && (
        <ExpenseForm
          onSuccess={() => {
            setShowForm(false);
            loadExpenses();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingExpense && (
        <ExpenseForm
          initialExpense={editingExpense}
          userId={selectedAccount?.id}
          onSuccess={() => {
            setEditingExpense(null);
            loadExpenses();
          }}
          onCancel={() => setEditingExpense(null)}
        />
      )}

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <Card className="w-full max-w-md dark:bg-gray-900 dark:border-gray-800 shadow-2xl">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">{selectedExpense.description}</h3>
              <div className="space-y-2 mb-4 sm:mb-6 text-sm sm:text-base text-gray-700 dark:text-gray-300">
                <p><strong>Valor:</strong> {formatMoney(selectedExpense.amount_cents)}</p>
                <p><strong>Data:</strong> {formatDate(selectedExpense.debit_date)}</p>
                <p><strong>Estado:</strong> {selectedExpense.paid ? 'Pago' : 'Não pago'}</p>
                {selectedExpense.recurring && (
                  <>
                    <p><strong>Tipo:</strong> Despesa recorrente</p>
                    <p><strong>Periodicidade:</strong> {recurrenceLabel(selectedExpense.recurrence_months)}</p>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedExpense(null)}
                  className="text-sm"
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    const newPaid = !selectedExpense.paid;
                    expensesAPI.updatePaid(selectedExpense.id, newPaid, selectedAccount?.id)
                      .then(() => {
                        setSelectedExpense(null);
                        toast.success(newPaid ? `"${selectedExpense.description}" marcada como paga!` : `"${selectedExpense.description}" marcada como não paga.`);
                        loadExpenses();
                      })
                      .catch((err) => {
                        console.error(err);
                        toast.error('Erro ao atualizar estado da despesa');
                      });
                  }}
                  disabled={selectedAccount !== null && !selectedAccount.permissions?.can_write}
                  className="text-sm"
                >
                  {selectedExpense.paid ? 'Não pago' : 'Pago'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleEditExpense(selectedExpense)}
                  disabled={selectedAccount !== null && !selectedAccount.permissions?.can_write}
                  className="text-sm"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    const exp = selectedExpense;
                    setSelectedExpense(null);
                    setExpenseToDelete(exp);
                  }}
                  disabled={selectedAccount !== null && !selectedAccount.permissions?.can_delete}
                  className="text-sm"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Apagar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Confirmação para Apagar */}
      <ConfirmModal
        isOpen={expenseToDelete !== null}
        title="Apagar Despesa"
        message={`Tem a certeza que deseja apagar "${expenseToDelete?.description}"? Esta ação é irreversível.`}
        confirmText="Apagar"
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={confirmDeleteExpense}
        onCancel={() => setExpenseToDelete(null)}
      />

      {/* Modal de Seleção Direta de Mês */}
      <MonthPickerModal
        isOpen={showMonthPicker}
        currentMonth={currentMonth}
        onSelect={(newMonth) => setCurrentMonth(newMonth)}
        onClose={() => setShowMonthPicker(false)}
      />

      {/* Barra de Navegação Inferior para Mobile */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingInvitations={pendingInvitations}
        isAdmin={user?.role === 'admin'}
      />
    </div>
  );
}
