'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { savingsAPI } from '@/lib/api';
import { Saving, SavingTransaction } from '@/types';
import { formatMoney, formatDate } from '@/lib/utils';
import { 
  PiggyBank, 
  Plus, 
  Minus, 
  Trash2, 
  Edit3, 
  History, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  X, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  Calendar,
  Bell
} from 'lucide-react';

export function SavingsScreen() {
  const toast = useToast();
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Criar / Editar Poupança
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSaving, setEditingSaving] = useState<Saving | null>(null);
  const [formName, setFormName] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formInitial, setFormInitial] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formReminderDate, setFormReminderDate] = useState(false);
  const [formReminderDays, setFormReminderDays] = useState(7);
  const [formReminderTarget, setFormReminderTarget] = useState(true);
  const [submittingForm, setSubmittingForm] = useState(false);

  // Modal Registar Movimento (+ Adicionar / - Subtrair)
  const [txModalSaving, setTxModalSaving] = useState<Saving | null>(null);
  const [txType, setTxType] = useState<'deposit' | 'withdraw'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingTx, setSubmittingTx] = useState(false);

  // Modal / Drawer de Histórico
  const [historySaving, setHistorySaving] = useState<Saving | null>(null);
  const [transactions, setTransactions] = useState<SavingTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Confirmação para apagar
  const [savingToDelete, setSavingToDelete] = useState<Saving | null>(null);

  useEffect(() => {
    loadSavings();
  }, []);

  const loadSavings = async () => {
    setLoading(true);
    try {
      const res = await savingsAPI.getAll();
      setSavings(res.data);
    } catch (err) {
      console.error('Falha ao carregar poupanças:', err);
      toast.error('Erro ao carregar lista de poupanças');
    } finally {
      setLoading(false);
    }
  };

  // Totais agregados
  const totalAccumulatedCents = useMemo(() => {
    return savings.reduce((acc, s) => acc + (s.current_amount_cents || 0), 0);
  }, [savings]);

  const totalTargetCents = useMemo(() => {
    return savings.reduce((acc, s) => acc + (s.target_amount_cents || 0), 0);
  }, [savings]);

  // Abertura do modal de criação
  const handleOpenCreate = () => {
    setEditingSaving(null);
    setFormName('');
    setFormTarget('');
    setFormInitial('');
    setFormTargetDate('');
    setFormReminderDate(false);
    setFormReminderDays(7);
    setFormReminderTarget(true);
    setIsFormOpen(true);
  };

  // Abertura do modal de edição
  const handleOpenEdit = (saving: Saving) => {
    setEditingSaving(saving);
    setFormName(saving.name);
    setFormTarget(saving.target_amount_cents ? (saving.target_amount_cents / 100).toString() : '');
    setFormInitial('');
    setFormTargetDate(saving.target_date || '');
    setFormReminderDate(saving.reminder_date_enabled === 1);
    setFormReminderDays(saving.reminder_days_before || 7);
    setFormReminderTarget(saving.reminder_target_reached_enabled !== 0);
    setIsFormOpen(true);
  };

  // Submeter formulário de poupança (Criar / Editar)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Por favor indique um nome para a poupança');
      return;
    }

    setSubmittingForm(true);
    try {
      const targetCents = formTarget.trim() !== '' ? Math.round(parseFloat(formTarget.replace(',', '.')) * 100) : null;
      const initialCents = formInitial.trim() !== '' ? Math.round(parseFloat(formInitial.replace(',', '.')) * 100) : 0;
      const cleanTargetDate = formTargetDate.trim() ? formTargetDate.trim() : null;
      const cleanReminderDate = formReminderDate ? 1 : 0;
      const cleanReminderDays = formReminderDays || 7;
      const cleanReminderTarget = formReminderTarget ? 1 : 0;

      if (editingSaving) {
        await savingsAPI.update(editingSaving.id, {
          name: formName.trim(),
          target_amount_cents: targetCents && targetCents > 0 ? targetCents : null,
          target_date: cleanTargetDate,
          reminder_date_enabled: cleanReminderDate,
          reminder_days_before: cleanReminderDays,
          reminder_target_reached_enabled: cleanReminderTarget
        });
        toast.success('Poupança atualizada com sucesso!');
      } else {
        await savingsAPI.create({
          name: formName.trim(),
          target_amount_cents: targetCents && targetCents > 0 ? targetCents : null,
          initial_amount_cents: initialCents && initialCents > 0 ? initialCents : 0,
          target_date: cleanTargetDate,
          reminder_date_enabled: cleanReminderDate,
          reminder_days_before: cleanReminderDays,
          reminder_target_reached_enabled: cleanReminderTarget
        });
        toast.success('Poupança criada com sucesso!');
      }

      setIsFormOpen(false);
      loadSavings();
    } catch (err: any) {
      console.error('Erro ao guardar poupança:', err);
      toast.error(err.response?.data?.error || 'Não foi possível guardar a poupança');
    } finally {
      setSubmittingForm(false);
    }
  };

  // Abertura do modal de transação (+ Adicionar / - Subtrair)
  const handleOpenTransaction = (saving: Saving, type: 'deposit' | 'withdraw') => {
    setTxModalSaving(saving);
    setTxType(type);
    setTxAmount('');
    setTxDescription('');
    setTxDate(new Date().toISOString().split('T')[0]);
  };

  // Submeter transação
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txModalSaving) return;

    const val = parseFloat(txAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      toast.error('Por favor indique um valor válido superior a zero');
      return;
    }

    const amountCents = Math.round(val * 100);

    setSubmittingTx(true);
    try {
      await savingsAPI.addTransaction(txModalSaving.id, {
        amount_cents: amountCents,
        type: txType,
        description: txDescription.trim() || (txType === 'deposit' ? 'Depósito' : 'Retirada'),
        date: txDate
      });

      toast.success(txType === 'deposit' ? 'Valor adicionado com sucesso!' : 'Valor subtraído com sucesso!');
      setTxModalSaving(null);
      loadSavings();
    } catch (err: any) {
      console.error('Erro ao registar movimento:', err);
      toast.error(err.response?.data?.error || 'Erro ao processar o movimento');
    } finally {
      setSubmittingTx(false);
    }
  };

  // Abertura do histórico de transações
  const handleOpenHistory = async (saving: Saving) => {
    setHistorySaving(saving);
    setLoadingTransactions(true);
    try {
      const res = await savingsAPI.getTransactions(saving.id);
      setTransactions(res.data);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Apagar movimento específico
  const handleDeleteTransaction = async (txId: number) => {
    if (!confirm('Deseja anular este movimento? O saldo da poupança será recalculado automaticamente.')) {
      return;
    }

    try {
      await savingsAPI.deleteTransaction(txId);
      toast.success('Movimento anulado com sucesso!');
      if (historySaving) {
        handleOpenHistory(historySaving);
      }
      loadSavings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao anular movimento');
    }
  };

  // Apagar poupança
  const handleConfirmDeleteSaving = async () => {
    if (!savingToDelete) return;
    try {
      await savingsAPI.delete(savingToDelete.id);
      toast.success('Poupança apagada com sucesso');
      setSavingToDelete(null);
      loadSavings();
    } catch (err) {
      toast.error('Erro ao apagar poupança');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">A carregar poupanças...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Totais e Ação Principal */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-primary-700 text-white rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
          <PiggyBank className="w-48 h-48" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                <PiggyBank className="w-5 h-5 text-white" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">As Minhas Poupanças</h2>
            </div>
            <p className="text-emerald-100 text-xs sm:text-sm">
              Faça a gestão dos seus mealheiros, fundos de emergência e objetivos financeiros.
            </p>
          </div>

          <Button
            onClick={handleOpenCreate}
            className="bg-white text-emerald-800 hover:bg-emerald-50 font-semibold shadow-sm text-xs sm:text-sm h-10 px-4 rounded-xl flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 text-emerald-700" />
            Nova Poupança
          </Button>
        </div>

        <div className="mt-6 pt-4 border-t border-white/20 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[11px] font-medium text-emerald-100 uppercase tracking-wider">Total Acumulado</p>
            <p className="text-xl sm:text-2xl font-extrabold mt-0.5">{formatMoney(totalAccumulatedCents)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-emerald-100 uppercase tracking-wider">Total em Metas</p>
            <p className="text-xl sm:text-2xl font-extrabold mt-0.5">
              {totalTargetCents > 0 ? formatMoney(totalTargetCents) : '—'}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[11px] font-medium text-emerald-100 uppercase tracking-wider">Poupanças Ativas</p>
            <p className="text-xl sm:text-2xl font-extrabold mt-0.5">{savings.length}</p>
          </div>
        </div>
      </div>

      {/* Lista de Poupanças */}
      {savings.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300 dark:border-gray-700 py-12 text-center bg-transparent">
          <CardContent className="space-y-4">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <PiggyBank className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Ainda não tem poupanças criadas</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                Defina objetivos com metas específicas ou crie mealheiros livres para acumular dinheiro com controlo total de depósitos e retiradas.
              </p>
            </div>
            <Button onClick={handleOpenCreate} className="text-xs sm:text-sm mt-2">
              <Plus className="w-4 h-4 mr-1.5" />
              Criar Primeira Poupança
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savings.map((saving) => {
            const hasTarget = saving.target_amount_cents !== null && saving.target_amount_cents > 0;
            const currentCents = saving.current_amount_cents || 0;
            const targetCents = saving.target_amount_cents || 0;
            const remainingCents = hasTarget ? Math.max(0, targetCents - currentCents) : null;
            const isCompleted = hasTarget && currentCents >= targetCents;
            const progressPercent = hasTarget ? Math.min(100, Math.round((currentCents / targetCents) * 100)) : 0;

            // Cálculo do prazo / data limite
            const hasTargetDate = !!saving.target_date;
            let daysRemaining: number | null = null;
            let deadlineStatusText = '';
            let deadlineStatusBadge = '';

            if (hasTargetDate && saving.target_date) {
              const [y, m, d] = saving.target_date.split('-').map(Number);
              const targetD = new Date(y, m - 1, d);
              const now = new Date();
              const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const diffTime = targetD.getTime() - todayD.getTime();
              daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

              if (daysRemaining > 1) {
                deadlineStatusText = `Faltam ${daysRemaining} dias`;
                deadlineStatusBadge = 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800';
              } else if (daysRemaining === 1) {
                deadlineStatusText = 'Termina amanhã!';
                deadlineStatusBadge = 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-semibold';
              } else if (daysRemaining === 0) {
                deadlineStatusText = 'Termina hoje!';
                deadlineStatusBadge = 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800 font-bold';
              } else {
                deadlineStatusText = `Prazo ultrapassado (${Math.abs(daysRemaining)}d)`;
                deadlineStatusBadge = 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800';
              }
            }

            return (
              <Card 
                key={saving.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow transition-all flex flex-col justify-between"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Topo do Card: Nome e Ações de Edição/Remoção */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                        isCompleted 
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' 
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {isCompleted ? <Sparkles className="w-5 h-5" /> : <PiggyBank className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">
                          {saving.name}
                        </h3>

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {hasTarget ? (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Target className="w-3 h-3 text-gray-400" />
                              Meta: {formatMoney(targetCents)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Acumulação livre
                            </span>
                          )}

                          {hasTargetDate && (
                            <span className="text-[11px] text-gray-600 dark:text-gray-300 flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-medium">
                              <Calendar className="w-3 h-3 text-gray-500" />
                              {formatDate(saving.target_date!)}
                            </span>
                          )}
                        </div>

                        {/* Badges de Lembretes e Estado do Prazo */}
                        {(hasTargetDate || saving.reminder_date_enabled === 1 || saving.reminder_target_reached_enabled === 1) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {hasTargetDate && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${deadlineStatusBadge}`}>
                                {deadlineStatusText}
                              </span>
                            )}
                            {saving.reminder_date_enabled === 1 && hasTargetDate && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 font-medium" title={`Lembrete programado para ${saving.reminder_days_before || 7} dias antes da data limite`}>
                                <Bell className="w-2.5 h-2.5 text-emerald-600" />
                                {saving.reminder_days_before || 7}d antes
                              </span>
                            )}
                            {saving.reminder_target_reached_enabled === 1 && hasTarget && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 font-medium" title="Notificação ativa ao completar a meta">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                Alerta meta
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(saving)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Ver histórico de movimentos"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(saving)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Editar poupança"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSavingToDelete(saving)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Apagar poupança"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Valor Acumulado e Valor que Falta */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        Valor Acumulado
                      </span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {formatMoney(currentCents)}
                      </span>
                    </div>

                    {/* Exibe o valor que falta apenas se houver meta definida */}
                    {hasTarget && (
                      <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60 flex items-baseline justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                          {isCompleted ? 'Estado:' : 'Falta para a meta:'}
                        </span>
                        {isCompleted ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Meta Atingida! 🎉
                          </span>
                        ) : (
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {formatMoney(remainingCents!)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Barra de Progresso visual se tiver meta */}
                    {hasTarget && (
                      <div className="space-y-1 pt-1">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 rounded-full ${
                              isCompleted ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>{progressPercent}% concluído</span>
                          <span>{formatMoney(targetCents)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botões Rápidos: Adicionar (+) e Subtrair (-) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenTransaction(saving, 'deposit')}
                      className="h-9 text-xs font-semibold border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenTransaction(saving, 'withdraw')}
                      disabled={currentCents <= 0}
                      className="h-9 text-xs font-semibold border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      Subtrair
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Poupança */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-emerald-600" />
                {editingSaving ? 'Editar Poupança' : 'Nova Poupança'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Poupança *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Férias, Fundo de Emergência, Carro..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                  Valor a Atingir / Meta (€)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Opcional (ex: 1000.00)"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Se deixar em branco, não será calculada meta nem valor em falta (mealheiro livre).
                </p>
              </div>

              {!editingSaving && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Valor Inicial Acumulado (€)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Opcional (ex: 50.00)"
                    value={formInitial}
                    onChange={(e) => setFormInitial(e.target.value)}
                  />
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Pode começar com saldo 0 ou com um valor que já tenha de lado.
                  </p>
                </div>
              )}

              {/* Data Limite / Prazo */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Data Limite (Prazo)</span>
                  <span className="text-[10px] font-normal text-gray-400 lowercase">opcional</span>
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="text-sm"
                  />
                  {formTargetDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormTargetDate('');
                        setFormReminderDate(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800"
                      title="Limpar data limite"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Defina um prazo caso pretenda completar esta poupança até uma data específica.
                </p>
              </div>

              {/* Notificações Selecionáveis */}
              <div className="bg-emerald-50/50 dark:bg-gray-800/60 rounded-xl p-3.5 border border-emerald-100 dark:border-gray-700 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                  <Bell className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Notificações e Alertas Programados</span>
                </div>

                {/* Opção 1: Aproximação da Data Limite */}
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formReminderDate}
                      onChange={(e) => {
                        if (!formTargetDate && !formReminderDate) {
                          toast.error('Indique primeiro uma data limite para ativar este aviso');
                          return;
                        }
                        setFormReminderDate(e.target.checked);
                      }}
                      className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <span className={`text-xs font-semibold ${formTargetDate ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                        Avisar sobre aproximação da data limite
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {formTargetDate 
                          ? 'Notificação agendada na aplicação e push antes de atingir o prazo.'
                          : 'Defina uma data limite acima para programar este aviso.'}
                      </p>
                    </div>
                  </label>

                  {formReminderDate && formTargetDate && (
                    <div className="pl-6 pt-1 flex items-center gap-2">
                      <label className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                        Antecedência do aviso:
                      </label>
                      <select
                        value={formReminderDays}
                        onChange={(e) => setFormReminderDays(parseInt(e.target.value, 10))}
                        className="text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium"
                      >
                        <option value={1}>1 dia antes</option>
                        <option value={3}>3 dias antes</option>
                        <option value={5}>5 dias antes</option>
                        <option value={7}>7 dias antes (recomendado)</option>
                        <option value={15}>15 dias antes</option>
                        <option value={30}>30 dias antes</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Opção 2: Valor Definido / Meta Completado */}
                <div className="pt-2.5 border-t border-emerald-100/80 dark:border-gray-700/80">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formReminderTarget}
                      onChange={(e) => {
                        if (!formTarget && !formReminderTarget) {
                          toast.error('Indique primeiro um valor a atingir / meta para ativar este aviso');
                          return;
                        }
                        setFormReminderTarget(e.target.checked);
                      }}
                      className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <span className={`text-xs font-semibold ${formTarget && parseFloat(formTarget.replace(',', '.')) > 0 ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                        Avisar quando o valor definido for completado
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {formTarget && parseFloat(formTarget.replace(',', '.')) > 0
                          ? 'Notificação imediata assim que atingir 100% do objetivo estipulado.'
                          : 'Defina um valor de meta acima para ativar.'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={submittingForm}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingForm}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submittingForm ? 'A guardar...' : editingSaving ? 'Guardar Alterações' : 'Criar Poupança'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Movimento (+ Adicionar / - Subtrair) */}
      {txModalSaving && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {txType === 'deposit' ? (
                  <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-amber-600" />
                )}
                {txType === 'deposit' ? 'Adicionar Valor' : 'Subtrair Valor'}
              </h3>
              <button
                type="button"
                onClick={() => setTxModalSaving(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Poupança: <strong className="text-gray-800 dark:text-gray-200">{txModalSaving.name}</strong> 
              {' '}(Saldo atual: {formatMoney(txModalSaving.current_amount_cents)})
            </p>

            <form onSubmit={handleSaveTransaction} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                  Valor a {txType === 'deposit' ? 'Adicionar' : 'Subtrair'} (€) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  required
                  autoFocus
                  className="text-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                  Descrição ou Nota (Opcional)
                </label>
                <Input
                  type="text"
                  placeholder={txType === 'deposit' ? 'Ex: Poupança do mês, Bónus...' : 'Ex: Despesa inesperada, Compra...'}
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                  Data do Movimento
                </label>
                <Input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTxModalSaving(null)}
                  disabled={submittingTx}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingTx}
                  className={txType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
                >
                  {submittingTx ? 'A registar...' : txType === 'deposit' ? 'Confirmar Depósito' : 'Confirmar Retirada'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Movimentos */}
      {historySaving && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <History className="w-5 h-5 text-primary-600" />
                  Histórico de Movimentos
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {historySaving.name} • Saldo atual: <strong>{formatMoney(historySaving.current_amount_cents)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistorySaving(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 scrollbar-thin">
              {loadingTransactions ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  A carregar movimentos...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  Ainda não existem movimentos registados nesta poupança.
                </div>
              ) : (
                transactions.map((tx) => {
                  const isDeposit = tx.type === 'deposit';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isDeposit
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                        }`}>
                          {isDeposit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                            {tx.description || (isDeposit ? 'Depósito' : 'Retirada')}
                          </p>
                          <span className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {formatDate(tx.date)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${
                          isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {isDeposit ? '+' : '-'}{formatMoney(tx.amount_cents)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors ml-1"
                          title="Anular movimento"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHistorySaving(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação para apagar poupança */}
      {savingToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
              Apagar Poupança
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tem a certeza que deseja apagar a poupança <strong>"{savingToDelete.name}"</strong>? O histórico de movimentos associado será igualmente removido.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSavingToDelete(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDeleteSaving}
              >
                Apagar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

