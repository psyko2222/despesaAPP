'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { settingsAPI, backupAPI, authAPI, adminAPI } from '@/lib/api';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellOff, CheckCircle2, AlertCircle, Send, Loader2 } from 'lucide-react';
import { Settings } from '@/types';

export function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsAPI.get();
      setSettings(response.data);
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
      await settingsAPI.update({ ...settings, auto_cleanup_years: cleanupYears });
      alert('Definições guardadas com sucesso!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Erro ao guardar definições');
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
    } catch (error) {
      console.error('Failed to export backup:', error);
      alert('Erro ao exportar backup');
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
      alert('Backup importado com sucesso!');
      loadSettings();
    } catch (error) {
      console.error('Failed to import backup:', error);
      alert('Erro ao importar backup');
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
      alert('Erro ao verificar estatísticas de limpeza');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!cleanupStats || cleanupStats.stats.totalToDelete === 0) {
      alert('Não há registos para apagar');
      return;
    }

    if (!confirm(`Tem a certeza que deseja apagar ${cleanupStats.stats.totalToDelete} registos antigos? Esta ação é irreversível!`)) {
      return;
    }

    setCleanupDeleting(true);
    try {
      const response = await adminAPI.cleanupExpenses(cleanupYears);
      alert(`${response.data.deletedCount} registos apagados com sucesso!`);
      setCleanupStats(null);
    } catch (error) {
      console.error('Failed to cleanup expenses:', error);
      alert('Erro ao apagar registos antigos');
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
        <p className="mt-2 text-gray-600">A carregar definições...</p>
      </div>
    );
  }

  const tabs = ['Notificações', 'Aplicação', 'Dados', 'Segurança', 'Limpeza'];

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b mb-6 overflow-x-auto scrollbar-hide">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === index
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 0 && (
        <div className="space-y-6">
          {/* Card de Notificações Push do Dispositivo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary-600" />
                Notificações no Dispositivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Ative as notificações para receber lembretes de débito diretamente no telemóvel ou computador, mesmo com a aplicação fechada.
              </p>

              {/* Estado do Suporte e Permissão */}
              {!pushSupported ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Este navegador não suporta notificações Web Push. Se estiver no iOS (iPhone), adicione primeiro o site ao ecrã inicial.</span>
                </div>
              ) : pushPermission === 'denied' ? (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>As notificações estão bloqueadas nas permissões do seu navegador. Ative as permissões nas definições do browser.</span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    {pushSubscribed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <BellOff className="w-5 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700">
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
                    className="w-full flex items-center justify-center gap-2 border-primary-200 text-primary-700 hover:bg-primary-50"
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
                <p className="text-xs text-center text-emerald-700 font-medium bg-emerald-50 p-2 rounded">
                  {testNotificationFeedback}
                </p>
              )}
              {pushError && (
                <p className="text-xs text-center text-red-600 font-medium bg-red-50 p-2 rounded">
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
              <div className="flex items-center justify-between">
                <label className="text-gray-700 font-medium">Ativar lembretes automáticos</label>
                <input
                  type="checkbox"
                  checked={settings.debit_notifications_enabled === 1 || settings.notifications_enabled === 1}
                  onChange={(e) => {
                    const val = e.target.checked ? 1 : 0;
                    setSettings({ ...settings, debit_notifications_enabled: val, notifications_enabled: val });
                  }}
                  className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1 font-medium">1º Lembrete:</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={settings.debit_reminder_days}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setSettings({ ...settings, debit_reminder_days: isNaN(v) ? 0 : v });
                    }}
                    min="0"
                    max="30"
                    className="w-24"
                  />
                  <span className="text-gray-600 text-sm">
                    {settings.debit_reminder_days === 0 ? 'dia(s) (no próprio dia do débito)' : settings.debit_reminder_days === 1 ? 'dia (na véspera)' : 'dias antes'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-gray-700 font-medium block">Ativar 2º lembrete</label>
                    <span className="text-xs text-gray-500">Ex: 1º lembrete 2 dias antes e 2º no próprio dia</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.second_debit_reminder_enabled === 1}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        second_debit_reminder_enabled: e.target.checked ? 1 : 0
                      });
                    }}
                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                  />
                </div>

                {settings.second_debit_reminder_enabled === 1 && (
                  <div className="mt-2 pl-2 border-l-2 border-primary-200">
                    <label className="block text-gray-700 mb-1 text-sm font-medium">Antecedência do 2º lembrete:</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={settings.second_debit_reminder_days ?? 0}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          setSettings({ ...settings, second_debit_reminder_days: isNaN(v) ? 0 : v });
                        }}
                        min="0"
                        max="30"
                        className="w-24"
                      />
                      <span className="text-gray-600 text-sm">
                        {(settings.second_debit_reminder_days ?? 0) === 0 ? 'dia(s) (no próprio dia do débito)' : (settings.second_debit_reminder_days ?? 0) === 1 ? 'dia (na véspera)' : 'dias antes'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs leading-relaxed">
                ℹ️ <strong>Horário Fixo:</strong> Os lembretes são verificados e enviados diariamente às <strong>10:00</strong> da manhã através do serviço agendado. Se houver despesas a debitar, receberá um alerta no telemóvel e um resumo por email.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Aplicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-1">Tolerância (%)</label>
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
              <label className="block text-gray-700 mb-1">Janela de estatísticas (meses)</label>
              <Input
                type="number"
                value={settings.stats_window_months}
                onChange={(e) => setSettings({ ...settings, stats_window_months: parseInt(e.target.value) || 0 })}
                min="1"
                max="60"
              />
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
              <h3 className="font-semibold mb-2">Backup</h3>
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="w-full"
              >
                {exporting ? 'A exportar...' : 'Exportar Backup'}
              </Button>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Restaurar</h3>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing}
                className="w-full"
              />
              {importing && <p className="text-sm text-gray-600 mt-1">A importar...</p>}
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600">
                Versão aceite dos termos: {settings.terms_accepted_version}
              </p>
              {settings.terms_accepted_at && (
                <p className="text-sm text-gray-600">
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
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
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
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
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
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
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
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
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
              <label className="block text-gray-700 mb-1">Apagar registos com mais de (anos):</label>
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

            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="text-sm text-blue-800">
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
              <div className="bg-gray-50 border border-gray-200 p-4 rounded space-y-2">
                <h4 className="font-semibold">Estatísticas de Limpeza:</h4>
                <p className="text-sm">
                  <strong>Total a apagar:</strong> {cleanupStats.stats.totalToDelete} registos
                </p>
                <p className="text-sm">
                  <strong>Valor total:</strong> €{cleanupStats.stats.totalAmount?.toFixed(2)}
                </p>
                {cleanupStats.stats.oldestDate && (
                  <p className="text-sm">
                    <strong>Registo mais antigo:</strong> {new Date(cleanupStats.stats.oldestDate).toLocaleDateString('pt-PT')}
                  </p>
                )}
                {cleanupStats.stats.newestDate && (
                  <p className="text-sm">
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
    </div>
  );
}
