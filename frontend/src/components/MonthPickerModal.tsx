'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { currentFinancialPeriodMonth } from '@/lib/utils';

interface MonthPickerModalProps {
  isOpen: boolean;
  currentMonth: string; // 'YYYY-MM'
  onSelect: (month: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function MonthPickerModal({
  isOpen,
  currentMonth,
  onSelect,
  onClose
}: MonthPickerModalProps) {
  const [selectedYear, setSelectedYear] = useState(() => {
    const parts = (currentMonth || '').split('-');
    return parts[0] ? parseInt(parts[0], 10) : new Date().getFullYear();
  });

  if (!isOpen) return null;

  const [activeYearStr, activeMonthStr] = (currentMonth || '').split('-');
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonth = parseInt(activeMonthStr, 10);

  const handleSelectMonth = (monthIndex: number) => {
    const monthNum = String(monthIndex + 1).padStart(2, '0');
    onSelect(`${selectedYear}-${monthNum}`);
    onClose();
  };

  const handleCurrentMonth = () => {
    const current = currentFinancialPeriodMonth();
    onSelect(current);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl w-full max-w-xs p-5 space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-base">
            <Calendar className="w-5 h-5" />
            <span>Selecionar Período</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Year Navigator */}
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700/60">
          <button
            type="button"
            onClick={() => setSelectedYear((y) => y - 1)}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-base">
            {selectedYear}
          </span>
          <button
            type="button"
            onClick={() => setSelectedYear((y) => y + 1)}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 12 Months Grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, idx) => {
            const isSelected = selectedYear === activeYear && idx + 1 === activeMonth;

            return (
              <button
                key={name}
                type="button"
                onClick={() => handleSelectMonth(idx)}
                className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* Jump to Current Month */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCurrentMonth}
            className="w-full text-xs"
          >
            Voltar ao Mês Atual
          </Button>
        </div>
      </div>
    </div>
  );
}

