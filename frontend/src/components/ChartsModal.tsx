'use client';

import React, { useState, useEffect } from 'react';
import { X, PieChart as PieChartIcon, BarChart as BarChartIcon, TrendingUp, TrendingDown, Calendar, ArrowRight, Minus } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { expensesAPI } from '@/lib/api';
import { getPreviousMonth, formatMoney, getFinancialPeriodDisplay } from '@/lib/utils';
import { Expense } from '@/types';

interface ChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonthKey: string; // YYYY-MM
  userId?: number;
}

const COLORS = [
  '#2563eb', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#64748b', // slate
];

function getShortMonthLabel(monthKey: string): string {
  try {
    const [year, monthNum] = monthKey.split('-').map(Number);
    const date = new Date(year, monthNum - 1, 1);
    const monthName = new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(date);
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  } catch {
    return monthKey;
  }
}

export function ChartsModal({ isOpen, onClose, currentMonthKey, userId }: ChartsModalProps) {
  const [tab, setTab] = useState<'circular' | 'barras'>('circular');
  
  // Pie chart state
  const [pieMonth, setPieMonth] = useState(currentMonthKey);
  const [pieData, setPieData] = useState<any[]>([]);
  const [pieLoading, setPieLoading] = useState(false);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Bar chart state
  const [barMonth1, setBarMonth1] = useState(currentMonthKey);
  const [barMonth2, setBarMonth2] = useState(getPreviousMonth(currentMonthKey));
  const [barData, setBarData] = useState<any[]>([]);
  const [barTotals, setBarTotals] = useState<{
    m1: { total: number; fixed: number; variable: number };
    m2: { total: number; fixed: number; variable: number };
  }>({
    m1: { total: 0, fixed: 0, variable: 0 },
    m2: { total: 0, fixed: 0, variable: 0 }
  });
  const [barLoading, setBarLoading] = useState(false);

  // Sync pieMonth with currentMonthKey when opened
  useEffect(() => {
    if (isOpen) {
      setPieMonth(currentMonthKey);
      setBarMonth1(currentMonthKey);
      setBarMonth2(getPreviousMonth(currentMonthKey));
      setActivePieIndex(null);
    }
  }, [isOpen, currentMonthKey]);

  // Load Pie Data
  useEffect(() => {
    if (!isOpen || tab !== 'circular') return;
    
    async function loadPie() {
      setPieLoading(true);
      setActivePieIndex(null);
      try {
        const res = await expensesAPI.getMonth(pieMonth, userId);
        const expenses: Expense[] = res.data;
        
        // Group by description
        const grouped: Record<string, number> = {};
        expenses.forEach(e => {
          const desc = e.description?.trim() || 'Sem descrição';
          if (!grouped[desc]) grouped[desc] = 0;
          grouped[desc] += (e.amount_cents || 0) / 100;
        });

        const sorted = Object.keys(grouped)
          .map(desc => ({ name: desc, value: grouped[desc] }))
          .filter(item => item.value > 0)
          .sort((a, b) => b.value - a.value);

        // Group smaller items into "Outros" if there are more than 7
        if (sorted.length > 7) {
          const top6 = sorted.slice(0, 6);
          const othersValue = sorted.slice(6).reduce((sum, item) => sum + item.value, 0);
          if (othersValue > 0) {
            top6.push({ name: 'Outros', value: othersValue });
          }
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
          return { fixed, variable, total: fixed + variable };
        };

        const t1 = calcTotals(res1.data);
        const t2 = calcTotals(res2.data);

        setBarTotals({ m1: t1, m2: t2 });

        setBarData([
          {
            name: getShortMonthLabel(barMonth1),
            fullName: getFinancialPeriodDisplay(barMonth1),
            Fixas: t1.fixed,
            Variáveis: t1.variable,
            Total: t1.total,
          },
          {
            name: getShortMonthLabel(barMonth2),
            fullName: getFinancialPeriodDisplay(barMonth2),
            Fixas: t2.fixed,
            Variáveis: t2.variable,
            Total: t2.total,
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

  const totalPieValue = pieData.reduce((sum, item) => sum + (item.value || 0), 0);

  // Custom tooltip for Pie
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percent = totalPieValue > 0 ? ((data.value / totalPieValue) * 100).toFixed(1) : '0';
      return (
        <div className="bg-gray-900/95 text-white dark:bg-gray-800/95 dark:text-gray-100 p-2.5 rounded-xl shadow-xl border border-gray-700 text-xs backdrop-blur-sm z-50 pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.fill }} />
            <span className="font-bold text-sm">{data.name}</span>
          </div>
          <div className="flex justify-between items-center gap-4 text-gray-300">
            <span>Valor: <strong className="text-white">{formatMoney(Math.round(data.value * 100))}</strong></span>
            <span className="font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded text-[10px]">{percent}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const diffMonth = barTotals.m1.total - barTotals.m2.total;
  const diffPercent = barTotals.m2.total > 0 ? (diffMonth / barTotals.m2.total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] max-h-[92dvh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <PieChartIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight">
                Estatísticas e Gráficos
              </h2>
              <p className="text-[11px] text-gray-400">
                Visualização e análise de despesas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900">
          <button
            onClick={() => setTab('circular')}
            className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
              tab === 'circular'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            <span>Peso Mensal (Circular)</span>
          </button>
          <button
            onClick={() => setTab('barras')}
            className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
              tab === 'barras'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <BarChartIcon className="w-4 h-4" />
            <span>Comparação Mensal</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB: PESO MENSAL (CIRCULAR / DONUT) */}
          {tab === 'circular' && (
            <div className="space-y-4">
              
              {/* Seletor do Mês */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gray-50 dark:bg-gray-800/50 p-2.5 sm:p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Mês a Analisar:
                  </span>
                </div>
                <input 
                  type="month" 
                  value={pieMonth} 
                  onChange={(e) => setPieMonth(e.target.value)}
                  className="text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-medium"
                />
              </div>

              {pieLoading ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span>A carregar despesas...</span>
                </div>
              ) : pieData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm text-center p-4">
                  <PieChartIcon className="w-12 h-12 stroke-1 text-gray-300 dark:text-gray-700 mb-2" />
                  <span>Não existem despesas registadas para este mês.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Donut Chart com Centro Informativo (Sem texto sobreposto) */}
                  <div className="relative w-full h-60 sm:h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                          onMouseEnter={(_, index) => setActivePieIndex(index)}
                          onMouseLeave={() => setActivePieIndex(null)}
                          onClick={(_, index) => setActivePieIndex(prev => prev === index ? null : index)}
                        >
                          {pieData.map((entry, index) => {
                            const isSelected = activePieIndex === index;
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={COLORS[index % COLORS.length]} 
                                stroke={isSelected ? '#ffffff' : 'transparent'}
                                strokeWidth={isSelected ? 3 : 1}
                                className="transition-all duration-200 cursor-pointer"
                                opacity={activePieIndex === null || isSelected ? 1 : 0.45}
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Centro do Donut: Total ou Detalhe do Item Selecionado */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                      {activePieIndex !== null && pieData[activePieIndex] ? (
                        <div className="animate-in fade-in zoom-in-95 duration-150">
                          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 line-clamp-1 max-w-[120px] mx-auto">
                            {pieData[activePieIndex].name}
                          </span>
                          <span className="text-base sm:text-lg font-black text-gray-900 dark:text-gray-100 block">
                            {formatMoney(Math.round(pieData[activePieIndex].value * 100))}
                          </span>
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400 block">
                            {((pieData[activePieIndex].value / totalPieValue) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                            Total do Mês
                          </span>
                          <span className="text-base sm:text-lg font-black text-gray-900 dark:text-gray-100 block">
                            {formatMoney(Math.round(totalPieValue * 100))}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            {pieData.length} categorias
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Instrução rápida e elegante */}
                  <p className="text-[11px] text-center text-gray-400 dark:text-gray-500">
                    Toque numa fatia ou num item abaixo para focar detalhes
                  </p>

                  {/* Lista Estruturada de Categorias (Livre de sobreposições em qualquer ecrã) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pieData.map((item, index) => {
                      const percent = totalPieValue > 0 ? (item.value / totalPieValue) * 100 : 0;
                      const isSelected = activePieIndex === index;
                      const color = COLORS[index % COLORS.length];

                      return (
                        <div
                          key={item.name}
                          onClick={() => setActivePieIndex(isSelected ? null : index)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-primary-50 dark:bg-primary-950/50 border-primary-400 dark:border-primary-600 shadow-xs ring-1 ring-primary-400/50' 
                              : 'bg-gray-50/70 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800 hover:bg-gray-100/70 dark:hover:bg-gray-800/70'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                            <span 
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-2 ring-white dark:ring-gray-900" 
                              style={{ backgroundColor: color }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">
                                {item.name}
                              </p>
                              {/* Barra de progresso visual da proporção */}
                              <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div 
                                  className="h-full rounded-full transition-all duration-300" 
                                  style={{ width: `${percent}%`, backgroundColor: color }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">
                              {formatMoney(Math.round(item.value * 100))}
                            </p>
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                              {percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: COMPARAÇÃO MENSAL (BARRAS) */}
          {tab === 'barras' && (
            <div className="space-y-4">
              
              {/* Seletor dos 2 meses para comparar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Mês A:</span>
                  <input 
                    type="month" 
                    value={barMonth1} 
                    onChange={(e) => setBarMonth1(e.target.value)}
                    className="text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-gray-800 dark:text-gray-200 font-medium"
                  />
                </div>
                
                <span className="text-xs font-bold text-gray-400 text-center uppercase tracking-wider">VS</span>

                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Mês B:</span>
                  <input 
                    type="month" 
                    value={barMonth2} 
                    onChange={(e) => setBarMonth2(e.target.value)}
                    className="text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-gray-800 dark:text-gray-200 font-medium"
                  />
                </div>
              </div>

              {barLoading ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span>A carregar comparação...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Cartões Comparativos de Resumo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    
                    {/* Mês A */}
                    <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60 space-y-1">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                        {getShortMonthLabel(barMonth1)}
                      </span>
                      <p className="text-base font-black text-gray-900 dark:text-gray-100">
                        {formatMoney(Math.round(barTotals.m1.total * 100))}
                      </p>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex justify-between">
                        <span>Fixas: {formatMoney(Math.round(barTotals.m1.fixed * 100))}</span>
                        <span>Var: {formatMoney(Math.round(barTotals.m1.variable * 100))}</span>
                      </div>
                    </div>

                    {/* Mês B */}
                    <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/60 space-y-1">
                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                        {getShortMonthLabel(barMonth2)}
                      </span>
                      <p className="text-base font-black text-gray-900 dark:text-gray-100">
                        {formatMoney(Math.round(barTotals.m2.total * 100))}
                      </p>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex justify-between">
                        <span>Fixas: {formatMoney(Math.round(barTotals.m2.fixed * 100))}</span>
                        <span>Var: {formatMoney(Math.round(barTotals.m2.variable * 100))}</span>
                      </div>
                    </div>

                    {/* Variação */}
                    <div className={`p-3 rounded-xl border space-y-1 ${
                      diffMonth > 0 
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/60' 
                        : diffMonth < 0 
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/60' 
                        : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
                    }`}>
                      <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        {diffMonth > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                        ) : diffMonth < 0 ? (
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 text-gray-500" />
                        )}
                        Variação (A vs B)
                      </span>
                      <p className={`text-base font-black ${
                        diffMonth > 0 
                          ? 'text-amber-700 dark:text-amber-300' 
                          : diffMonth < 0 
                          ? 'text-emerald-700 dark:text-emerald-300' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {diffMonth > 0 ? '+' : ''}{formatMoney(Math.round(diffMonth * 100))}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-500">
                        {diffPercent > 0 ? `+${diffPercent.toFixed(1)}% de despesa` : diffPercent < 0 ? `${diffPercent.toFixed(1)}% de despesa` : 'Sem alteração'}
                      </p>
                    </div>

                  </div>

                  {/* Gráfico de Barras */}
                  <div className="h-64 sm:h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis 
                          tickFormatter={(val) => `€${val}`} 
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          axisLine={{ stroke: '#e5e7eb' }}
                          width={55}
                        />
                        <Tooltip 
                          formatter={(value: number) => formatMoney(value * 100)} 
                          contentStyle={{
                            backgroundColor: 'rgba(17, 24, 39, 0.95)',
                            borderColor: '#374151',
                            borderRadius: '0.75rem',
                            color: '#fff',
                            fontSize: '0.75rem'
                          }}
                        />
                        <Bar dataKey="Fixas" stackId="a" fill="#2563eb" radius={[0, 0, 4, 4]} name="Despesas Fixas" />
                        <Bar dataKey="Variáveis" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Despesas Variáveis" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legenda das Barras */}
                  <div className="flex items-center justify-center gap-6 text-xs text-gray-600 dark:text-gray-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-[#2563eb]" />
                      <span>Despesas Fixas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-[#f59e0b]" />
                      <span>Despesas Variáveis</span>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
