'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Home, Repeat, BarChart3, Settings, Users, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExpenseForm } from '@/components/ExpenseForm';
import { StatisticsScreen } from '@/components/StatisticsScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { SharesScreen } from '@/components/SharesScreen';
import { AdminPanel } from '@/components/AdminPanel';
import { formatMoney, formatDate, currentFinancialPeriodMonth, getNextMonth, getPreviousMonth, getFinancialPeriodDisplay, recurrenceLabel, getPaymentDeadlines, financialPeriod, formatAmount } from '@/lib/utils';
import { expensesAPI, sharesAPI } from '@/lib/api';
import { Expense, AccountShare } from '@/types';

type Tab = 'month' | 'regular' | 'stats' | 'shares' | 'settings' | 'admin';

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
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

  const handleDeleteExpense = async (expense: Expense) => {
    if (!confirm(`Tem a certeza que deseja apagar "${expense.description}"?`)) {
      return;
    }

    try {
      await expensesAPI.delete(expense.id, expense.recurring === 1, selectedAccount?.id);
      setSelectedExpense(null);
      loadExpenses();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      alert('Erro ao apagar despesa');
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <img src="/icon-192.png" alt="Despesas" className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg" />
            <h1 className="text-xl sm:text-2xl font-bold text-primary-600">Despesas</h1>
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
                className="border rounded px-2 py-1 text-xs sm:text-sm max-w-[120px] sm:max-w-none"
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

      {/* Navigation Tabs */}
      <nav className="bg-white border-b sticky top-16 z-10">
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
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label === 'Mês' ? 'Mês' : tab.label === 'Regulares' ? 'Reg' : tab.label === 'Estatísticas' ? 'Est' : tab.label === 'Partilhas' ? 'Part' : 'Def'}</span>
                  {tab.id === 'shares' && pendingInvitations > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {pendingInvitations}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {activeTab === 'month' && (
          <div>
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <Button
                variant="outline"
                onClick={() => setCurrentMonth(getPreviousMonth(currentMonth))}
                className="text-xs sm:text-sm px-2 sm:px-4"
              >
                ← Ant
              </Button>
              <h2 className="text-sm sm:text-xl font-semibold text-center px-2">
                {getFinancialPeriodDisplay(currentMonth)}
              </h2>
              <Button
                variant="outline"
                onClick={() => setCurrentMonth(getNextMonth(currentMonth))}
                className="text-xs sm:text-sm px-2 sm:px-4"
              >
                Seg →
              </Button>
            </div>

            {/* Summary Card */}
            <Card className="mb-4 sm:mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-blue-900">Resumo do Mês</h3>
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 text-sm sm:text-base">Total em despesas:</span>
                    <span className="font-bold text-lg sm:text-xl text-blue-700">
                      {formatMoney(expenses.reduce((sum, exp) => sum + exp.amount_cents, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 text-sm sm:text-base">Total não pago:</span>
                    <span className="font-bold text-lg sm:text-xl text-red-600">
                      {formatMoney(expenses.filter(exp => !exp.paid).reduce((sum, exp) => sum + exp.amount_cents, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 text-sm sm:text-base">Falta pagar até dia 1:</span>
                    <span className="font-bold text-lg sm:text-xl text-orange-600">
                      {(() => {
                        const day1Expenses = expenses.filter(exp => {
                          if (exp.paid) return false;
                          const expDate = new Date(exp.debit_date);
                          const deadline = getPaymentDeadlines(currentMonth).day1;
                          const period = financialPeriod(currentMonth);
                          const isInPeriod = expDate >= period.start && expDate <= period.end;
                          return isInPeriod && expDate <= deadline;
                        });
                        const total = day1Expenses.reduce((sum, exp) => sum + exp.amount_cents, 0);
                        const hasNoValueExpenses = day1Expenses.some(exp => exp.amount_cents === 0 && exp.fixed_amount === 0);
                        return (
                          <>
                            {formatMoney(total)}
                            {hasNoValueExpenses && <span className="text-orange-600 ml-1">*</span>}
                          </>
                        );
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 text-sm sm:text-base">Falta pagar até dia 20:</span>
                    <span className="font-bold text-lg sm:text-xl text-orange-600">
                      {(() => {
                        const day20Expenses = expenses.filter(exp => {
                          if (exp.paid) return false;
                          const expDate = new Date(exp.debit_date);
                          const deadline = getPaymentDeadlines(currentMonth).day20;
                          const period = financialPeriod(currentMonth);
                          const isInPeriod = expDate >= period.start && expDate <= period.end;
                          return isInPeriod && expDate <= deadline;
                        });
                        const total = day20Expenses.reduce((sum, exp) => sum + exp.amount_cents, 0);
                        const hasNoValueExpenses = day20Expenses.some(exp => exp.amount_cents === 0 && exp.fixed_amount === 0);
                        return (
                          <>
                            {formatMoney(total)}
                            {hasNoValueExpenses && <span className="text-orange-600 ml-1">*</span>}
                          </>
                        );
                      })()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add Expense Button */}
            <div className="mb-4 sm:mb-6">
              <Button
                onClick={() => setShowForm(true)}
                className="w-full text-sm sm:text-base"
                disabled={selectedAccount !== null && !selectedAccount.permissions?.can_write}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Despesa
              </Button>
              {selectedAccount && !selectedAccount.permissions?.can_write && (
                <p className="text-xs sm:text-sm text-gray-500 text-center mt-2">
                  Não tem permissão para adicionar despesas a esta conta
                </p>
              )}
            </div>

            {/* Expenses List */}
            {loadingExpenses ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 text-sm sm:text-base">A carregar despesas...</p>
              </div>
            ) : expenses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-600 text-sm sm:text-base">
                  Sem despesas neste período
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {expenses.map((expense) => {
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
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        hasNoValue 
                          ? 'bg-yellow-50 border-yellow-300' 
                          : expense.paid 
                            ? 'bg-green-50 border-green-300' 
                            : 'bg-red-50 border-red-300'
                      }`}
                      onClick={() => setSelectedExpense(expense)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm sm:text-base truncate">
                              {expense.description}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600">
                              {formatDate(expense.debit_date)}
                            </p>
                            {expense.recurring && (
                              <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                                {recurrenceLabel(expense.recurrence_months)}
                              </span>
                            )}
                          </div>
                          <div className="text-right ml-2 sm:ml-4">
                            <p className="font-semibold text-base sm:text-lg">
                              {formatAmount(expense.amount_cents, expense.fixed_amount)}
                              {hasNoValue && !expense.paid && (isDueByDay1 || isDueByDay20) && <span className="text-orange-600 ml-1">*</span>}
                            </p>
                            {hasNoValue ? (
                              <span className="text-xs text-yellow-600">Sem valor</span>
                            ) : expense.paid ? (
                              <span className="text-xs text-green-600">Pago</span>
                            ) : (
                              <span className="text-xs text-red-600">Não pago</span>
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
            <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">
              Despesas Regulares - {getFinancialPeriodDisplay(currentMonth)}
            </h2>
            {recurringExpenses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-600 text-sm sm:text-base">
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
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        hasNoValue 
                          ? 'bg-yellow-50 border-yellow-300' 
                          : expense.paid 
                            ? 'bg-green-50 border-green-300' 
                            : 'bg-red-50 border-red-300'
                      }`}
                      onClick={() => setSelectedExpense(expense)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm sm:text-base truncate">{expense.description}</h3>
                            <p className="text-xs sm:text-sm text-gray-600">
                              Próximo débito: {formatDate(expense.debit_date)}
                            </p>
                            <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                              {recurrenceLabel(expense.recurrence_months)}
                            </span>
                          </div>
                          <div className="text-right ml-2 sm:ml-4">
                            <p className="font-semibold text-base sm:text-lg">
                              {formatAmount(expense.amount_cents, expense.fixed_amount)}
                            </p>
                            {hasNoValue ? (
                              <span className="text-xs text-yellow-600">Sem valor</span>
                            ) : expense.paid ? (
                              <span className="text-xs text-green-600">Pago</span>
                            ) : (
                              <span className="text-xs text-red-600">Não pago</span>
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
          <div className="h-[calc(100vh-12rem)] overflow-y-auto">
            <SettingsScreen />
          </div>
        )}

        {activeTab === 'admin' && (
          <AdminPanel />
        )}
      </main>

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">{selectedExpense.description}</h3>
              <div className="space-y-2 mb-4 sm:mb-6 text-sm sm:text-base">
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
                    expensesAPI.updatePaid(selectedExpense.id, !selectedExpense.paid, selectedAccount?.id)
                      .then(() => {
                        setSelectedExpense(null);
                        loadExpenses();
                      })
                      .catch(console.error);
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
                  onClick={() => handleDeleteExpense(selectedExpense)}
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
    </div>
  );
}
