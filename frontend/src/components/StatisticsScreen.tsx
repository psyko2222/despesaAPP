'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney, currentFinancialPeriodMonth, getPreviousMonth, getFinancialPeriodDisplay, compareValues, financialPeriod } from '@/lib/utils';
import { expensesAPI, settingsAPI } from '@/lib/api';
import { Expense, Settings, StatsComparison, StatsComparisonOptions, StatisticsSummaryResponse } from '@/types';

export function StatisticsScreen({ userId }: { userId?: number } = {}) {
  const currentMonthStr = currentFinancialPeriodMonth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<Expense[]>([]);
  const [recurringSeries, setRecurringSeries] = useState<Map<number, Expense[]>>(new Map());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<StatsComparison>('WINDOW_AVERAGE');
  const [showComparisonDropdown, setShowComparisonDropdown] = useState(false);
  const [currentYearTotal, setCurrentYearTotal] = useState<number>(0);
  const [previousYearEquivalentTotal, setPreviousYearEquivalentTotal] = useState<number>(0);
  const [statsData, setStatsData] = useState<StatisticsSummaryResponse | null>(null);

  useEffect(() => {
    loadStatistics();
  }, [userId]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      // 1. Fetch settings (or use existing)
      const settingsPromise = settings ? Promise.resolve({ data: settings }) : settingsAPI.get();

      // 2. Try fast aggregated statistics endpoint from backend
      try {
        const settingsRes = await settingsPromise;
        const currentSettings = settingsRes.data;
        setSettings(currentSettings);

        const summaryRes = await expensesAPI.getStatisticsSummary({
          month: currentMonthStr,
          windowMonths: currentSettings.stats_window_months || 3,
          userId
        });
        const data = summaryRes.data;
        setStatsData(data);
        setExpenses(data.currentMonthExpenses);
        setRecurringExpenses(data.recurringExpenses);

        const seriesMap = new Map<number, Expense[]>();
        if (data.recurringSeries) {
          Object.entries(data.recurringSeries).forEach(([key, seriesList]) => {
            seriesMap.set(Number(key), seriesList);
          });
        }
        setRecurringSeries(seriesMap);
        setCurrentYearTotal(data.currentYearTotal);
        setPreviousYearEquivalentTotal(data.previousYearEquivalentTotal);
        return;
      } catch (summaryErr) {
        console.warn('Fast statistics summary failed, falling back to parallel fetch:', summaryErr);
      }

      // 3. Fallback: Fast parallel loader using Promise.all
      const [monthData, recurringData, settingsData] = await Promise.all([
        expensesAPI.getMonth(currentMonthStr, userId),
        expensesAPI.getRecurring(userId),
        settingsPromise
      ]);
      setExpenses(monthData.data);
      setRecurringExpenses(recurringData.data);
      if (!settings) setSettings(settingsData.data);

      const windowMonthsCount = (settings || settingsData.data).stats_window_months || 3;

      // Load all series in parallel
      const seriesPromises = recurringData.data.map(async (expense) => {
        const seriesId = expense.series_id || expense.id;
        const res = await expensesAPI.getSeries(seriesId, userId);
        return { seriesId, data: res.data };
      });

      const [year, month] = currentMonthStr.split('-').map(Number);

      // Financial year totals in parallel
      const currYearPromises = Array.from({ length: month }, (_, i) =>
        expensesAPI.getMonth(`${year}-${String(i + 1).padStart(2, '0')}`, userId)
      );
      const prevYearPromises = Array.from({ length: month }, (_, i) =>
        expensesAPI.getMonth(`${year - 1}-${String(i + 1).padStart(2, '0')}`, userId)
      );

      // Window data in parallel
      const windowPromises = Array.from({ length: windowMonthsCount }, (_, i) =>
        expensesAPI.getMonth(getPreviousMonth(currentMonthStr, i), userId)
      );

      const [seriesResults, currYearResults, prevYearResults, windowResults] = await Promise.all([
        Promise.all(seriesPromises),
        Promise.all(currYearPromises),
        Promise.all(prevYearPromises),
        Promise.all(windowPromises)
      ]);

      const seriesMap = new Map<number, Expense[]>();
      seriesResults.forEach(({ seriesId, data }) => seriesMap.set(seriesId, data));
      setRecurringSeries(seriesMap);

      const currYearTotal = currYearResults.reduce((sum, res) =>
        sum + res.data.reduce((s, e) => s + e.amount_cents, 0), 0);
      const prevYearTotal = prevYearResults.reduce((sum, res) =>
        sum + res.data.reduce((s, e) => s + e.amount_cents, 0), 0);
      setCurrentYearTotal(currYearTotal);
      setPreviousYearEquivalentTotal(prevYearTotal);

      const windowTotals = windowResults.map(res =>
        res.data.reduce((s, e) => s + e.amount_cents, 0));
      const windowAvg = windowTotals.length > 0
        ? windowTotals.reduce((a, b) => a + b, 0) / windowTotals.length
        : null;

      const prevMonthData = windowResults[1] || await expensesAPI.getMonth(getPreviousMonth(currentMonthStr, 1), userId);
      const prevMonthTotal = prevMonthData.data.reduce((s, e) => s + e.amount_cents, 0);

      const prevYearMonthData = await expensesAPI.getMonth(`${year - 1}-${String(month).padStart(2, '0')}`, userId);
      const prevYearMonthTotal = prevYearMonthData.data.reduce((s, e) => s + e.amount_cents, 0);

      setStatsData({
        currentMonthExpenses: monthData.data,
        currentTotal: monthData.data.reduce((s, e) => s + e.amount_cents, 0),
        recurringExpenses: recurringData.data,
        recurringSeries: {},
        currentYearTotal: currYearTotal,
        previousYearEquivalentTotal: prevYearTotal,
        previousMonthTotal,
        previousYearMonthTotal,
        windowAverage: windowAvg,
        windowTotals
      });
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentTotal = expenses.reduce((sum, exp) => sum + exp.amount_cents, 0);

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

  // Calculate comparison reference instantly in memory
  const reference = useMemo(() => {
    if (!statsData) return null;
    switch (comparison) {
      case 'PREVIOUS_MONTH':
        return statsData.previousMonthTotal || null;
      case 'WINDOW_AVERAGE':
        return statsData.windowAverage;
      case 'PREVIOUS_YEAR':
        return statsData.previousYearMonthTotal || null;
      default:
        return null;
    }
  }, [comparison, statsData]);

  const totalTrend = compareValues(currentTotal, reference, tolerance);



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
                    {option.value === 'WINDOW_AVERAGE' ? `Média dos últimos ${windowMonths} meses` : option.label}
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
