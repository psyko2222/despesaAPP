'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney, currentFinancialPeriodMonth, getPreviousMonth, getFinancialPeriodDisplay, compareValues, financialPeriod } from '@/lib/utils';
import { expensesAPI, settingsAPI } from '@/lib/api';
import { Expense, Settings, StatsComparison, StatsComparisonOptions } from '@/types';

export function StatisticsScreen({ userId }: { userId?: number } = {}) {
  const currentMonthStr = currentFinancialPeriodMonth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<Expense[]>([]);
  const [recurringSeries, setRecurringSeries] = useState<Map<number, Expense[]>>(new Map());
  const [windowExpenses, setWindowExpenses] = useState<Expense[][]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<StatsComparison>('WINDOW_AVERAGE');
  const [showComparisonDropdown, setShowComparisonDropdown] = useState(false);
  const [reference, setReference] = useState<number | null>(null);
  const [currentYearTotal, setCurrentYearTotal] = useState<number>(0);
  const [previousYearEquivalentTotal, setPreviousYearEquivalentTotal] = useState<number>(0);

  useEffect(() => {
    loadStatistics();
  }, [comparison]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const [monthData, recurringData, settingsData] = await Promise.all([
        expensesAPI.getMonth(currentMonthStr, userId),
        expensesAPI.getRecurring(userId),
        settingsAPI.get()
      ]);
      setExpenses(monthData.data);
      setRecurringExpenses(recurringData.data);
      setSettings(settingsData.data);

      // Load series data for each recurring expense
      const seriesMap = new Map<number, Expense[]>();
      for (const expense of recurringData.data) {
        const seriesId = expense.series_id || expense.id;
        const seriesData = await expensesAPI.getSeries(seriesId, userId);
        seriesMap.set(seriesId, seriesData.data);
      }
      setRecurringSeries(seriesMap);

      // Load window data for comparison
      const windowMonths = settingsData.data.stats_window_months || 3;
      const windowData = await Promise.all(
        Array.from({ length: windowMonths }, (_, i) => 
          expensesAPI.getMonth(getPreviousMonth(currentMonthStr, i), userId)
        )
      );
      setWindowExpenses(windowData.map(d => d.data));

      // Calculate reference
      const ref = await getComparisonReference();
      setReference(ref);

      // Calculate year totals
      const currentYear = await financialYearTotal(0);
      const previousYear = await financialYearTotal(1);
      setCurrentYearTotal(currentYear);
      setPreviousYearEquivalentTotal(previousYear);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentTotal = expenses.reduce((sum, exp) => sum + exp.amount_cents, 0);

  // Calculate financial year totals
  const financialYearTotal = async (yearsBack: number): Promise<number> => {
    const [year, month] = currentMonthStr.split('-').map(Number);
    const displayMonth = new Date(year, month, 1);
    displayMonth.setFullYear(displayMonth.getFullYear() - yearsBack);
    
    let total = 0;
    for (let m = 1; m <= month; m++) {
      const periodStartMonth = `${displayMonth.getFullYear()}-${String(m).padStart(2, '0')}`;
      const monthData = await expensesAPI.getMonth(periodStartMonth, userId);
      total += monthData.data.reduce((sum, exp) => sum + exp.amount_cents, 0);
    }
    return total;
  };

  // Get value for a specific period from a series (like Android's valueForPeriod)
  const valueForPeriod = (series: Expense[], periodMonth: string): number | null => {
    const period = financialPeriod(periodMonth);
    
    const expensesInPeriod = series.filter(exp => {
      const expDate = new Date(exp.debit_date);
      return exp.amount_cents > 0 && expDate >= period.start && expDate <= period.end;
    });
    
    if (expensesInPeriod.length === 0) return null;
    
    // Return the latest expense in the period
    const latestExpense = expensesInPeriod.reduce((latest, current) => {
      const latestDate = new Date(latest.debit_date);
      const currentDate = new Date(current.debit_date);
      return currentDate > latestDate ? current : latest;
    });
    
    return latestExpense.amount_cents;
  };

  const windowMonths = settings?.stats_window_months || 3;
  const tolerance = settings?.tolerance || 2.0;
  const totalTrend = compareValues(currentTotal, reference, tolerance);

  // Calculate comparison reference
  const getComparisonReference = async (): Promise<number | null> => {
    switch (comparison) {
      case 'PREVIOUS_MONTH':
        const prevMonthData = await expensesAPI.getMonth(getPreviousMonth(currentMonthStr, 1), userId);
        return prevMonthData.data.reduce((sum, exp) => sum + exp.amount_cents, 0) || null;
      case 'WINDOW_AVERAGE':
        const totals = windowExpenses.map(monthExpenses => 
          monthExpenses.reduce((sum, exp) => sum + exp.amount_cents, 0)
        );
        return totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : null;
      case 'PREVIOUS_YEAR':
        const [year, month] = currentMonthStr.split('-').map(Number);
        const previousYearMonth = `${year - 1}-${String(month).padStart(2, '0')}`;
        const prevYearData = await expensesAPI.getMonth(previousYearMonth, userId);
        return prevYearData.data.reduce((sum, exp) => sum + exp.amount_cents, 0) || null;
      default:
        return null;
    }
  };



  // Get trend indicator
  const getTrendIndicator = (trend: any) => {
    if (trend.direction === 'UP') return '📈';
    if (trend.direction === 'DOWN') return '📉';
    return '➡️';
  };

  const getTrendColor = (trend: any) => {
    if (trend.direction === 'UP') return 'text-red-600';
    if (trend.direction === 'DOWN') return 'text-green-600';
    return 'text-gray-600';
  };

  const getComparisonLabel = () => {
    switch (comparison) {
      case 'PREVIOUS_MONTH': return 'Mês anterior';
      case 'WINDOW_AVERAGE': return `Média dos últimos ${windowMonths} meses`;
      case 'PREVIOUS_YEAR': return 'Mesmo mês do ano anterior';
    }
  };

  const getShortComparisonLabel = () => {
    switch (comparison) {
      case 'PREVIOUS_MONTH': return 'mês anterior';
      case 'WINDOW_AVERAGE': return `média ${windowMonths}m`;
      case 'PREVIOUS_YEAR': return 'ano anterior';
    }
  };

  return (
    <div>
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">A carregar estatísticas...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Settings Info */}
          <div className="text-sm text-gray-600 space-y-1">
            <p>Tolerância: {tolerance.toFixed(1)}%</p>
            <p>Janela: média dos últimos {windowMonths} meses</p>
            <p>Desce abaixo de -{tolerance}%, mantém entre -{tolerance}% e +{tolerance}%, sobe acima de +{tolerance}%</p>
          </div>

          {/* Comparison Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowComparisonDropdown(!showComparisonDropdown)}
              className="w-full"
            >
              Comparar com: {getComparisonLabel()}
            </Button>
            
            {showComparisonDropdown && (
              <div className="absolute z-10 w-full mt-2 bg-white border rounded shadow-lg">
                {StatsComparisonOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setComparison(option.value);
                      setShowComparisonDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total atual</span>
                  <span className="text-2xl font-bold">{formatMoney(currentTotal)}</span>
                </div>
                {reference !== null && (
                  <div className={`flex justify-between items-center ${getTrendColor(totalTrend)}`}>
                    <span className="text-gray-600">Vs {getShortComparisonLabel()}</span>
                    <div className="flex items-center space-x-2">
                      <span>{getTrendIndicator(totalTrend)}</span>
                      <span className="font-semibold">
                        {totalTrend.direction === 'UNKNOWN' ? 'Sem dados' : `${totalTrend.percent > 0 ? '+' : ''}${totalTrend.percent.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total ano corrente</span>
                  <span className="text-lg font-semibold">{formatMoney(currentYearTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total ano anterior equivalente</span>
                  <span className="text-lg font-semibold">{formatMoney(previousYearEquivalentTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recurring Expenses with Statistics */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Despesa a despesa</h3>
            {recurringExpenses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-600">
                  Ainda não existem dados de despesas regulares
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {recurringExpenses.map((expense) => {
                  const seriesId = expense.series_id || expense.id;
                  const series = recurringSeries.get(seriesId) || [];
                  
                  const currentValue = valueForPeriod(series, currentMonthStr);
                  const [year, month] = currentMonthStr.split('-').map(Number);
                  const previousYearValue = valueForPeriod(series, `${year - 1}-${String(month).padStart(2, '0')}`);
                  const previousMonthValue = valueForPeriod(series, getPreviousMonth(currentMonthStr, 1));
                  
                  // Calculate window average using valueForPeriod for each month
                  const windowMonthsCount = settings?.stats_window_months || 3;
                  const windowValues = [];
                  for (let i = 1; i <= windowMonthsCount; i++) {
                    const monthStr = getPreviousMonth(currentMonthStr, i);
                    const value = valueForPeriod(series, monthStr);
                    if (value !== null) {
                      windowValues.push(value);
                    }
                  }
                  const windowAverage = windowValues.length > 0 
                    ? windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length 
                    : null;
                  
                  const expenseReference = (() => {
                    switch (comparison) {
                      case 'PREVIOUS_MONTH':
                        return previousMonthValue;
                      case 'WINDOW_AVERAGE':
                        return windowAverage;
                      case 'PREVIOUS_YEAR':
                        return previousYearValue;
                      default:
                        return null;
                    }
                  })();
                  
                  const expenseTrend = currentValue !== null ? compareValues(currentValue, expenseReference, tolerance) : { percent: 0, direction: 'UNKNOWN' };
                  
                  return (
                    <Card key={expense.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{expense.description}</span>
                          <span className="font-semibold">{currentValue !== null ? formatMoney(currentValue) : 'Sem valor'}</span>
                        </div>
                        {expenseReference !== null && (
                          <div className={`flex justify-between items-center text-sm ${getTrendColor(expenseTrend)}`}>
                            <span className="text-gray-600">Vs {getShortComparisonLabel()}</span>
                            <div className="flex items-center space-x-2">
                              <span>{getTrendIndicator(expenseTrend)}</span>
                              <span className="font-semibold">
                                {expenseTrend.direction === 'UNKNOWN' ? 'Sem dados' : `${expenseTrend.percent > 0 ? '+' : ''}${expenseTrend.percent.toFixed(1)}%`}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
