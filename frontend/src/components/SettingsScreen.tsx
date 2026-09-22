'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { settingsAPI, backupAPI, authAPI, adminAPI } from '@/lib/api';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/components/ui/toast';
import { Bell, BellOff, CheckCircle2, AlertCircle, Send, Loader2, Sun, Moon, Monitor, Sliders, Database, Lock, Trash2, Download, Laptop, BookOpen } from 'lucide-react';
import { InstallGuideModal } from '@/components/InstallGuideModal';
import { Settings } from '@/types';

const SETTINGS_TABS = [
  { id: 0, label: 'Notificações', icon: Bell, desc: 'Lembretes e avisos' },
  { id: 1, label: 'Aplicação', icon: Sliders, desc: 'Tema e tolerância' },
  { id: 2, label: 'Dados', icon: Database, desc: 'Backup e restauro' },
  { id: 3, label: 'Segurança', icon: Lock, desc: 'Alterar password' },
  { id: 4, label: 'Limpeza', icon: Trash2, desc: 'Registos antigos' },
];

export function SettingsScreen() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cleanupYears, setCleanupYears] = useState(2);
  const [cleanupStats, setCleanupStats] = useState<any>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDeleting, setCleanupDeleting] = useState(false);

  // Push notifications hook
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    loading: pushLoading,
    actionLoading: pushActionLoading,
    error: pushError,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    sendTestNotification,
  } = usePushNotifications();
  const [testNotificationFeedback, setTestNotificationFeedback] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    loadSettings();
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
    setTheme(savedTheme);

    if (typeof window !== 'undefined') {
      setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

      const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        setInstallPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
        setIsStandalone(true);
        toast.success('Aplicação instalada com sucesso!');
      }
    } catch (err) {
      console.error('Falha ao acionar instalação:', err);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    const isDark =
      newTheme === 'dark' ||
      (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    toast.success(`Tema definido para ${newTheme === 'light' ? 'Claro' : newTheme === 'dark' ? 'Escuro' : 'Sistema'}`);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsAPI.get();
      const data = response.data;
      if (data) {
        if (data.same_day_reminder_enabled === undefined) {
          data.same_day_reminder_enabled = 1;
        }
        if (data.no_value_reminder_enabled === undefined) {
          data.no_value_reminder_enabled = 0;
        }
        if (!data.no_value_reminder_days) {
          data.no_value_reminder_days = '1,10,15,20';
        }
      }
      setSettings(data);
      if (response.data.auto_cleanup_years) {
        setCleanupYears(response.data.auto_cleanup_years);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const anyReminderActive =
        (settings.debit_notifications_enabled === 1) ||
        (settings.second_debit_reminder_enabled === 1) ||
        ((settings.same_day_reminder_enabled ?? 1) === 1) ||
        (settings.no_value_reminder_enabled === 1);

      await settingsAPI.update({
        ...settings,
        notifications_enabled: anyReminderActive ? 1 : 0,
        auto_cleanup_years: cleanupYears
      });
      toast.success('Definições guardadas com sucesso!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Erro ao guardar definições');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await backupAPI.export();
      const data = JSON.stringify(response.data, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `despesas-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup exportado com sucesso!');
    } catch (error) {
      console.error('Failed to export backup:', error);
      toast.error('Erro ao exportar backup');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await backupAPI.import(data);
      toast.success('Backup importado com sucesso!');
      loadSettings();
    } catch (error) {
      console.error('Failed to import backup:', error);
      toast.error('Erro ao importar backup');
    } finally {
      setImporting(false);
    }
  };

  const handleCheckCleanup = async () => {
    setCleanupLoading(true);
    try {
      const response = await adminAPI.getCleanupStats(cleanupYears);
      setCleanupStats(response.data);
    } catch (error) {
      console.error('Failed to check cleanup stats:', error);
      toast.error('Erro ao verificar estatísticas de limpeza');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!cleanupStats || cleanupStats.stats.totalToDelete === 0) {
      toast.info('Não há registos para apagar');
      return;
    }

    if (!confirm(`Tem a certeza que deseja apagar ${cleanupStats.stats.totalToDelete} registos antigos? Esta ação é irreversível!`)) {
      return;
    }

    setCleanupDeleting(true);
    try {
      const response = await adminAPI.cleanupExpenses(cleanupYears);
      toast.success(`${response.data.deletedCount} registos apagados com sucesso!`);
      setCleanupStats(null);
    } catch (error) {
      console.error('Failed to cleanup expenses:', error);
      toast.error('Erro ao apagar registos antigos');
    } finally {
      setCleanupDeleting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Todos os campos são obrigatórios');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('A nova password deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As passwords não coincidem');
      return;
    }

    setChangingPassword(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Não foi possível alterar a password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">A carregar definições...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Seletor Mobile Dropdown Proeminente (sm:hidden) */}
      <div className="sm:hidden">
        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
          Separador de Definições:
        </label>
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(Number(e.target.value))}
          className="w-full py-2.5 px-3 bg-white dark:bg-gray-900 border-2 border-primary-500 dark:border-primary-500 rounded-xl text-sm font-bold text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none"
        >
          {SETTINGS_TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} ({t.desc})
            </option>
          ))}
        </select>
      </div>

      {/* Barra de Tabs em Pílulas com Ícones */}
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 0 && (
        <div className="space-y-6">
          {/* Card de Notificações Push do Dispositivo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Notificações no Dispositivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ative as notificações para receber lembretes de débito diretamente no telemóvel ou computador, mesmo com a aplicação fechada.
              </p>

              {/* Estado do Suporte e Permissão */}
              {!pushSupported ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Este navegador não suporta notificações Web Push. Se estiver no iOS (iPhone), adicione primeiro o site ao ecrã inicial.</span>
                </div>
              ) : pushPermission === 'denied' ? (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>As notificações estão bloqueadas nas permissões do seu navegador. Ative as permissões nas definições do browser.</span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    {pushSubscribed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <BellOff className="w-5 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {pushSubscribed ? 'Notificações ativas neste dispositivo' : 'Notificações inativas neste dispositivo'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant={pushSubscribed ? 'outline' : 'default'}
                    size="sm"
                    disabled={pushActionLoading}
                    onClick={async () => {
                      setTestNotificationFeedback(null);
                      if (pushSubscribed) {
                        await unsubscribePush();
                      } else {
                        await subscribePush();
                      }
                    }}
                  >
                    {pushActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : pushSubscribed ? (
                      'Desativar'
                    ) : (
                      'Ativar Notificações'
                    )}
                  </Button>
                </div>
              )}

              {/* Botão de Notificação de Teste */}
              {pushSubscribed && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/50"
                    disabled={pushActionLoading}
                    onClick={async () => {
                      setTestNotificationFeedback(null);
                      const ok = await sendTestNotification();
                      if (ok) {
                        setTestNotificationFeedback('Notificação de teste enviada com sucesso! Verifique a barra de notificações.');
                      } else {
                        setTestNotificationFeedback('Não foi possível enviar a notificação de teste.');
                      }
                    }}
                  >
                    {pushActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Enviar Notificação de Teste Agora
                  </Button>
                </div>
              )}

              {/* Feedback do Teste ou Erro */}
              {testNotificationFeedback && (
                <p className="text-xs text-center text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded border border-emerald-200 dark:border-emerald-800">
                  {testNotificationFeedback}
                </p>
              )}
              {pushError && (
                <p className="text-xs text-center text-red-600 dark:text-red-300 font-medium bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-800">
                  {pushError}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card de Regras de Lembrete de Débito */}
          <Card>
            <CardHeader>
              <CardTitle>Regras de Lembretes de Débito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Escolha as notificações que pretende ativar com visto:
              </p>

              {/* 1º Lembrete Antecipado */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-gray-800 dark:text-gray-200 font-medium cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.debit_notifications_enabled === 1}
                      onChange={(e) => setSettings({ ...settings, debit_notifications_enabled: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span>1º Lembrete de antecedência</span>
                  </label>
                  {settings.debit_notifications_enabled === 1 ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">Ativo</span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Inativo</span>
                  )}
                </div>

                {settings.debit_notifications_enabled === 1 && (
                  <div className="flex items-center gap-2 pt-1 pl-6">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Avisar com</span>
                    <Input
                      type="number"
                      value={settings.debit_reminder_days}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setSettings({ ...settings, debit_reminder_days: isNaN(v) ? 1 : Math.max(1, v) });
                      }}
                      min="1"
                      max="30"
                      className="w-20 h-9"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {settings.debit_reminder_days === 1 ? 'dia de antecedência (véspera)' : 'dias de antecedência'}
                    </span>
                  </div>
                )}
              </div>

              {/* 2º Lembrete Antecipado */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-gray-800 dark:text-gray-200 font-medium cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.second_debit_reminder_enabled === 1}
                      onChange={(e) => setSettings({ ...settings, second_debit_reminder_enabled: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span>2º Lembrete de antecedência</span>
                  </label>
                  {settings.second_debit_reminder_enabled === 1 ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">Ativo</span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Inativo</span>
                  )}
                </div>

                {settings.second_debit_reminder_enabled === 1 && (
                  <div className="flex items-center gap-2 pt-1 pl-6">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Avisar com</span>
                    <Input
                      type="number"
                      value={settings.second_debit_reminder_days ?? 1}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setSettings({ ...settings, second_debit_reminder_days: isNaN(v) ? 1 : Math.max(1, v) });
                      }}
                      min="1"
                      max="30"
                      className="w-20 h-9"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {(settings.second_debit_reminder_days ?? 1) === 1 ? 'dia de antecedência (véspera)' : 'dias de antecedência'}
                    </span>
                  </div>
                )}
              </div>

              {/* 3º Verificação no próprio dia */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-gray-800 dark:text-gray-200 font-medium cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(settings.same_day_reminder_enabled ?? 1) === 1}
                      onChange={(e) => setSettings({ ...settings, same_day_reminder_enabled: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span>Verificação no próprio dia do débito</span>
                  </label>
                  {(settings.same_day_reminder_enabled ?? 1) === 1 ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">Ativo</span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Inativo</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 pl-6">
                  Alerta às 10:00 se houver despesas agendadas para hoje que ainda não tenham sido marcadas como pagas.
                </p>
              </div>

              {/* 4º Lembrete de Despesas Sem Valor */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-gray-800 dark:text-gray-200 font-medium cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.no_value_reminder_enabled === 1}
                      onChange={(e) => setSettings({ ...settings, no_value_reminder_enabled: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span>Verificar despesas sem valor</span>
                  </label>
                  {settings.no_value_reminder_enabled === 1 ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">Ativo</span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Inativo</span>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 pl-6">
                  Dispara às 10:00 nos dias selecionados apenas se existirem despesas sem valor por preencher.
                </p>

                {settings.no_value_reminder_enabled === 1 && (
                  <div className="pt-2 pl-6 space-y-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
                      Disparar nos seguintes dias do mês:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {['1', '10', '15', '20'].map((day) => {
                        const currentDaysList = (settings.no_value_reminder_days || '1,10,15,20')
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const isChecked = currentDaysList.includes(day);

                        return (
                          <label
                            key={day}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-primary-50 dark:bg-primary-950/50 border-primary-300 dark:border-primary-600 text-primary-800 dark:text-primary-300'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                let updated: string[];
                                if (isChecked) {
                                  updated = currentDaysList.filter((d) => d !== day);
                                } else {
                                  updated = [...currentDaysList, day].sort((a, b) => parseInt(a) - parseInt(b));
                                }
                                setSettings({
                                  ...settings,
                                  no_value_reminder_days: updated.join(',')
                                });
                              }}
                              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                            />
                            <span>Dia {day}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-900 dark:text-blue-200 text-xs leading-relaxed">
                ℹ️ <strong>Horário Fixo:</strong> Os lembretes são verificados e enviados diariamente às <strong>10:00</strong> da manhã diretamente para as notificações do seu dispositivo.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Aplicação e Aparência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Seletor de Tema Visual */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                Aparência da Aplicação
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all ${
                    theme === 'light'
                      ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:border-primary-500 dark:text-primary-300 ring-2 ring-primary-500/20 shadow-sm font-medium'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Sun className="w-5 h-5 text-amber-500" />
                  <span className="text-sm">Claro</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all ${
                    theme === 'dark'
                      ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:border-primary-500 dark:text-primary-300 ring-2 ring-primary-500/20 shadow-sm font-medium'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Moon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  <span className="text-sm">Escuro</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all ${
                    theme === 'system'
                      ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:border-primary-500 dark:text-primary-300 ring-2 ring-primary-500/20 shadow-sm font-medium'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Monitor className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm">Sistema</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A opção <strong>Sistema</strong> adapta-se automaticamente ao tema definido no seu telemóvel ou computador.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 mb-1">Tolerância (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.tolerance}
                  onChange={(e) => setSettings({ ...settings, tolerance: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-gray-700 dark:text-gray-300 mb-1">Janela de estatísticas (meses)</label>
                <Input
                  type="number"
                  value={settings.stats_window_months}
                  onChange={(e) => setSettings({ ...settings, stats_window_months: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="60"
                />
              </div>
            </div>

            {/* Secção de Instalação como App / PWA */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span>Instalação no Computador ou Telemóvel</span>
              </label>
              {isStandalone ? (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>A aplicação já se encontra instalada e a correr como app autónoma!</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowGuideModal(true)}
                    className="flex items-center gap-2 text-xs h-8"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Ver Instruções de Instalação para outros aparelhos</span>
                  </Button>
                </div>
              ) : (
                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Pode instalar esta aplicação no seu <strong>PC (Windows/Mac)</strong> ou <strong>Telemóvel (Android/iPhone)</strong> para que abra numa janela própria, sem a barra do navegador, com o seu próprio ícone no ambiente de trabalho ou menu iniciar.
                  </p>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    {installPrompt && (
                      <Button
                        type="button"
                        onClick={handleInstallApp}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-xs sm:text-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>Instalar Agora</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowGuideModal(true)}
                      className="flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Instruções de Instalação</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Backup</h3>
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="w-full"
              >
                {exporting ? 'A exportar...' : 'Exportar Backup'}
              </Button>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Restaurar</h3>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing}
                className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-950 dark:file:text-primary-300 cursor-pointer"
              />
              {importing && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">A importar...</p>}
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Versão aceite dos termos: {settings.terms_accepted_version}
              </p>
              {settings.terms_accepted_at && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Aceite em: {new Date(settings.terms_accepted_at).toLocaleDateString('pt-PT')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password Atual
                </label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nova Password
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirmar Nova Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              {passwordError && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded">
                  {passwordSuccess}
                </div>
              )}
              <Button
                type="submit"
                disabled={changingPassword}
                className="w-full"
              >
                {changingPassword ? 'A alterar...' : 'Alterar Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Limpeza de Registos Antigos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-1">Apagar registos com mais de (anos):</label>
              <div className="flex space-x-2">
                {[2, 3, 4, 5].map((years) => (
                  <Button
                    key={years}
                    type="button"
                    variant={cleanupYears === years ? "default" : "outline"}
                    onClick={() => {
                      setCleanupYears(years);
                      setCleanupStats(null);
                    }}
                  >
                    {years} anos
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 rounded">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Vão ser apagados todos os registos anteriores a {new Date(new Date().setFullYear(new Date().getFullYear() - cleanupYears)).getFullYear()}.
              </p>
            </div>

            <Button
              onClick={handleCheckCleanup}
              disabled={cleanupLoading}
              className="w-full"
            >
              {cleanupLoading ? 'A verificar...' : 'Verificar Registos a Apagar'}
            </Button>

            {cleanupStats && (
              <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-4 rounded space-y-2">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200">Estatísticas de Limpeza:</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Total a apagar:</strong> {cleanupStats.stats.totalToDelete} registos
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Valor total:</strong> €{cleanupStats.stats.totalAmount?.toFixed(2)}
                </p>
                {cleanupStats.stats.oldestDate && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Registo mais antigo:</strong> {new Date(cleanupStats.stats.oldestDate).toLocaleDateString('pt-PT')}
                  </p>
                )}
                {cleanupStats.stats.newestDate && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Registo mais recente:</strong> {new Date(cleanupStats.stats.newestDate).toLocaleDateString('pt-PT')}
                  </p>
                )}
                <Button
                  onClick={handleCleanup}
                  disabled={cleanupDeleting || cleanupStats.stats.totalToDelete === 0}
                  variant="destructive"
                  className="w-full mt-4"
                >
                  {cleanupDeleting ? 'A apagar...' : 'Apagar Registos Antigos'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="mt-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          {saving ? 'A guardar...' : 'Guardar Definições'}
        </Button>
        <p className="mt-4 text-center text-xs text-gray-400 select-none">
          Publicação: {process.env.NEXT_PUBLIC_BUILD_TIME || 'Desenvolvimento'}
        </p>
      </div>

      {/* Modal com Instruções de Instalação */}
      <InstallGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        onInstall={handleInstallApp}
        canInstallDirectly={!!installPrompt}
      />
    </div>
  );
}
