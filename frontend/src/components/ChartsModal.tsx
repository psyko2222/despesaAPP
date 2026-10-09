import React, { useState, useEffect } from 'react';
import { X, PieChart as PieChartIcon, BarChart as BarChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { expensesAPI } from '@/lib/api';
import { getPreviousMonth, formatMoney, getFinancialPeriodDisplay } from '@/lib/utils';
import { Expense } from '@/types';

interface ChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonthKey: string; // YYYY-MM
  userId?: number;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export function ChartsModal({ isOpen, onClose, currentMonthKey, userId }: ChartsModalProps) {
  const [tab, setTab] = useState<'circular' | 'barras'>('circular');
  
  // Pie chart state
  const [pieMonth, setPieMonth] = useState(currentMonthKey);
  const [pieData, setPieData] = useState<any[]>([]);
  const [pieLoading, setPieLoading] = useState(false);

  // Bar chart state
  const [barMonth1, setBarMonth1] = useState(currentMonthKey);
  const [barMonth2, setBarMonth2] = useState(getPreviousMonth(currentMonthKey));
  const [barData, setBarData] = useState<any[]>([]);
  const [barLoading, setBarLoading] = useState(false);

  // Sync pieMonth with currentMonthKey when opened
  useEffect(() => {
    if (isOpen) {
      setPieMonth(currentMonthKey);
      setBarMonth1(currentMonthKey);
      setBarMonth2(getPreviousMonth(currentMonthKey));
    }
  }, [isOpen, currentMonthKey]);

  // Load Pie Data
  useEffect(() => {
    if (!isOpen || tab !== 'circular') return;
    
    async function loadPie() {
      setPieLoading(true);
      try {
        const res = await expensesAPI.getMonth(pieMonth, userId);
        const expenses = res.data;
        
        // Group by description
        const grouped: Record<string, number> = {};
        expenses.forEach(e => {
          if (!grouped[e.description]) grouped[e.description] = 0;
          grouped[e.description] += (e.amount_cents || 0) / 100;
        });

        const sorted = Object.keys(grouped)
          .map(desc => ({ name: desc, value: grouped[desc] }))
          .sort((a, b) => b.value - a.value);

        // Group the smaller ones into "Outros" if there are more than 7
        if (sorted.length > 7) {
          const top6 = sorted.slice(0, 6);
          const othersValue = sorted.slice(6).reduce((sum, item) => sum + item.value, 0);
          top6.push({ name: 'Outros', value: othersValue });
          setPieData(top6);
        } else {
          setPieData(sorted);
        }
      } catch (error) {
        console.error('Error loading pie data', error);
      } finally {
        setPieLoading(false);
      }
    }
    loadPie();
  }, [isOpen, tab, pieMonth, userId]);

  // Load Bar Data
  useEffect(() => {
    if (!isOpen || tab !== 'barras') return;

    async function loadBar() {
      setBarLoading(true);
      try {
        const [res1, res2] = await Promise.all([
          expensesAPI.getMonth(barMonth1, userId),
          expensesAPI.getMonth(barMonth2, userId)
        ]);

        const calcTotals = (expenses: Expense[]) => {
          const fixed = expenses.filter(e => e.fixed_amount === 1).reduce((sum, e) => sum + (e.amount_cents || 0), 0) / 100;
          const variable = expenses.filter(e => e.fixed_amount === 0).reduce((sum, e) => sum + (e.amount_cents || 0), 0) / 100;
          return { Fixas: fixed, Variáveis: variable, Total: fixed + variable };
        };

        const t1 = calcTotals(res1.data);
        const t2 = calcTotals(res2.data);

        setBarData([
          {
            name: getFinancialPeriodDisplay(barMonth1),
            Fixas: t1.Fixas,
            Variáveis: t1.Variáveis,
          },
          {
            name: getFinancialPeriodDisplay(barMonth2),
            Fixas: t2.Fixas,
            Variáveis: t2.Variáveis,
          }
        ]);

      } catch (error) {
        console.error('Error loading bar data', error);
      } finally {
        setBarLoading(false);
      }
    }
    loadBar();
  }, [isOpen, tab, barMonth1, barMonth2, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <PieChartIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Estatísticas e Gráficos</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setTab('circular')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              tab === 'circular'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            Peso Mensal
          </button>
          <button
            onClick={() => setTab('barras')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              tab === 'barras'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <BarChartIcon className="w-4 h-4" />
            Comparação Mensal
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'circular' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 w-fit">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mês a Analisar:</span>
                <input 
                  type="month" 
                  value={pieMonth} 
                  onChange={(e) => setPieMonth(e.target.value)}
                  className="text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {pieLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-400">A carregar dados...</div>
              ) : pieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400">Sem dados para este mês.</div>
              ) : (
                <div className="h-80 w-full" style={{ minHeight: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatMoney(value * 100)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {tab === 'barras' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4 items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mês A:</span>
                  <input 
                    type="month" 
                    value={barMonth1} 
                    onChange={(e) => setBarMonth1(e.target.value)}
                    className="text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="text-gray-400 font-bold">VS</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mês B:</span>
                  <input 
                    type="month" 
                    value={barMonth2} 
                    onChange={(e) => setBarMonth2(e.target.value)}
                    className="text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {barLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-400">A carregar dados...</div>
              ) : (
                <div className="h-80 w-full" style={{ minHeight: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(val) => `€${val}`} />
                      <Tooltip formatter={(value: number) => formatMoney(value * 100)} />
                      <Legend />
                      <Bar dataKey="Fixas" stackId="a" fill="#2563eb" radius={[0, 0, 4, 4]} />
                      <Bar dataKey="Variáveis" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
