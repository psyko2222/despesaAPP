'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { expensesAPI } from '@/lib/api';
import { Expense } from '@/types';
import { formatDate, centsToInput, parseCents, recurrenceLabel, normalizedRecurrenceMonths } from '@/lib/utils';

interface ExpenseFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialExpense?: Expense;
  userId?: number;
}

export function ExpenseForm({ onSuccess, onCancel, initialExpense, userId }: ExpenseFormProps) {
  const [description, setDescription] = useState(initialExpense?.description || '');
  const [amount, setAmount] = useState(initialExpense ? centsToInput(initialExpense.amount_cents) : '');
  const [debitDate, setDebitDate] = useState(initialExpense?.debit_date || new Date().toISOString().split('T')[0]);
  const [paid, setPaid] = useState(initialExpense?.paid === 1);
  const [recurring, setRecurring] = useState(initialExpense?.recurring === 1);
  const [fixedAmount, setFixedAmount] = useState(initialExpense?.fixed_amount === 1);
  const [recurrenceMonths, setRecurrenceMonths] = useState(initialExpense?.recurrence_months || 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Allow empty amount for variable expenses
      let cents = 0;
      if (amount.trim()) {
        const parsedCents = parseCents(amount);
        if (parsedCents === null) {
          setError('Indique um valor válido');
          setLoading(false);
          return;
        }
        cents = parsedCents;
      }

      if (!description.trim()) {
        setError('Indique uma descrição');
        setLoading(false);
        return;
      }

      const expenseData = {
        description: description.trim(),
        amount_cents: cents,
        debit_date: debitDate,
        paid: paid ? 1 : 0,
        recurring: recurring ? 1 : 0,
        fixed_amount: fixedAmount ? 1 : 0,
        original_day: new Date(debitDate).getDate(),
        recurrence_months: recurring ? recurrenceMonths : 1,
      };

      console.log('Sending expense data:', expenseData);

      if (initialExpense) {
        await expensesAPI.update(initialExpense.id, expenseData, userId);
      } else {
        await expensesAPI.create(expenseData);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao guardar despesa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{initialExpense ? 'Editar Despesa' : 'Nova Despesa'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Renda, Internet, etc."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor (€) {recurring && !fixedAmount && <span className="text-gray-500 text-xs">(opcional para valores variáveis)</span>}
              </label>
              <Input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={recurring && !fixedAmount ? "Deixar vazio para valor variável" : "0.00"}
              />
              {recurring && !fixedAmount && (
                <p className="text-xs text-gray-500 mt-1">
                  {amount ? "Para voltar a 'sem valor', apague o valor acima" : "Vazio = sem valor"}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Débito
              </label>
              <Input
                type="date"
                value={debitDate}
                onChange={(e) => setDebitDate(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="paid"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="paid" className="text-sm">
                Pago
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="recurring"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="recurring" className="text-sm">
                Despesa Recorrente
              </label>
            </div>

            {recurring && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Periodicidade
                  </label>
                  <select
                    value={recurrenceMonths}
                    onChange={(e) => setRecurrenceMonths(parseInt(e.target.value))}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value={1}>Mensal</option>
                    <option value={2}>Bimestral</option>
                    <option value={3}>Trimestral</option>
                    <option value={6}>Semestral</option>
                    <option value={12}>Anual</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="fixedAmount"
                    checked={fixedAmount}
                    onChange={(e) => setFixedAmount(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="fixedAmount" className="text-sm">
                    Valor sempre igual
                  </label>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
