'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { logsAPI, settingsAPI } from '@/lib/api';
import api from '@/lib/api';

interface PendingUser {
  id: number;
  email: string;
  created_at: string;
  status: string;
  role: string;
  approval_token?: string;
  expires_at?: string;
}

interface AllUser {
  id: number;
  email: string;
  status: string;
  role: string;
  created_at: string;
  last_login?: string;
  has_pending_reset?: boolean;
}

interface LogEntry {
  id: number;
  level: string;
  message: string;
  details: string | null;
  user_id: number | null;
  route: string | null;
  method: string | null;
  ip_address: string | null;
  created_at: string;
}

interface EmailConfig {
  configured: boolean;
  sendgrid: boolean;
  smtp: boolean;
  frontendUrl: string;
}

interface PasswordResetRequest {
  id: number;
  user_id: number;
  email: string;
  user_role: string;
  status: string;
  requested_at: string;
  processed_at?: string;
  processed_by?: number;
}

export function AdminPanel() {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'logs' | 'config' | 'password-reset'>('pending');
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadPendingUsers();
      loadAllUsers();
      if (activeTab === 'logs') {
        loadLogs();
      }
      if (activeTab === 'config') {
        loadEmailConfig();
      }
      if (activeTab === 'password-reset') {
        loadPasswordResetRequests();
      }
    }
  }, [user, activeTab, logFilter]);

  const loadPendingUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users/pending');
      setPendingUsers(response.data);
    } catch (error) {
      console.error('Failed to load pending users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      setAllUsers(response.data);
    } catch (error) {
      console.error('Failed to load all users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (logFilter !== 'all') {
        params.level = logFilter;
      }
      const response = await logsAPI.getLogs(params);
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmailConfig = async () => {
    setLoading(true);
    try {
      const response = await settingsAPI.getEmailConfig();
      setEmailConfig(response.data);
    } catch (error) {
      console.error('Failed to load email config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPasswordResetRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/password-reset-requests');
      setPasswordResetRequests(response.data);
    } catch (error) {
      console.error('Failed to load password reset requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: number) => {
    setActionLoading(userId);
    try {
      await api.post(`/admin/users/${userId}/approve`, {});
      alert('Utilizador aprovado com sucesso!');
      loadPendingUsers();
      loadAllUsers();
    } catch (error) {
      console.error('Failed to approve user:', error);
      alert('Erro ao aprovar utilizador');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: number) => {
    if (!confirm('Tem a certeza que deseja rejeitar este utilizador?')) return;

    setActionLoading(userId);
    try {
      await api.post(`/admin/users/${userId}/reject`, {});
      alert('Utilizador rejeitado com sucesso!');
      loadPendingUsers();
      loadAllUsers();
    } catch (error) {
      console.error('Failed to reject user:', error);
      alert('Erro ao rejeitar utilizador');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async (userId: number) => {
    if (!confirm('Tem a certeza que deseja promover este utilizador a admin?')) return;

    setActionLoading(userId);
    try {
      await api.post(`/admin/users/${userId}/promote`, {});
      alert('Utilizador promovido a admin com sucesso!');
      loadAllUsers();
    } catch (error) {
      console.error('Failed to promote user:', error);
      alert('Erro ao promover utilizador');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDemote = async (userId: number) => {
    if (!confirm('Tem a certeza que deseja remover privilégios de admin deste utilizador?')) return;

    setActionLoading(userId);
    try {
      await api.post(`/admin/users/${userId}/demote`, {});
      alert('Utilizador despromovido com sucesso!');
      loadAllUsers();
    } catch (error) {
      console.error('Failed to demote user:', error);
      alert('Erro ao despromover utilizador');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Tem a certeza que deseja apagar este utilizador? TODOS os dados (despesas, definições) serão apagados permanentemente!')) return;

    setActionLoading(userId);
    try {
      await api.delete(`/admin/users/${userId}`);
      alert('Utilizador apagado com sucesso!');
      loadAllUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Erro ao apagar utilizador');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveResetRequest = async (requestId: number) => {
    setActionLoading(requestId);
    try {
      await api.post(`/auth/password-reset-requests/${requestId}/approve`, {});
      alert('Pedido de reset aprovado com sucesso!');
      loadPasswordResetRequests();
    } catch (error) {
      console.error('Failed to approve reset request:', error);
      alert('Erro ao aprovar pedido de reset');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectResetRequest = async (requestId: number) => {
    if (!confirm('Tem a certeza que deseja rejeitar este pedido de reset?')) return;

    setActionLoading(requestId);
    try {
      await api.post(`/auth/password-reset-requests/${requestId}/reject`, {});
      alert('Pedido de reset rejeitado com sucesso!');
      loadPasswordResetRequests();
    } catch (error) {
      console.error('Failed to reject reset request:', error);
      alert('Erro ao rejeitar pedido de reset');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Tem a certeza que deseja limpar os logs antigos (mais de 30 dias)?')) {
      return;
    }
    try {
      await logsAPI.clearLogs(30);
      loadLogs();
    } catch (error) {
      console.error('Failed to clear logs:', error);
      alert('Erro ao limpar logs');
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-PT');
  };

  if (user?.role !== 'admin') {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-600">Acesso apenas para administradores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Painel de Administração</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tabs */}
        <div className="flex border-b mb-6 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'pending'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Pendentes ({pendingUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'all'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Todos os Utilizadores ({allUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('password-reset')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'password-reset'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Reset Password ({passwordResetRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'logs'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Logs do Sistema
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'config'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Configuração Email
          </button>
        </div>

        {activeTab === 'pending' && (
          <>
            <h3 className="font-semibold mb-4">Utilizadores Pendentes de Aprovação</h3>

            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : pendingUsers.length === 0 ? (
              <p className="text-gray-600 text-center py-4">Sem utilizadores pendentes</p>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((pendingUser) => (
                  <div
                    key={pendingUser.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{pendingUser.email}</p>
                      <p className="text-sm text-gray-600">
                        Registado em: {new Date(pendingUser.created_at).toLocaleDateString('pt-PT')}
                      </p>
                      {pendingUser.expires_at && (
                        <p className="text-sm text-gray-500">
                          Expira em: {new Date(pendingUser.expires_at).toLocaleDateString('pt-PT')}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleApprove(pendingUser.id)}
                        disabled={actionLoading === pendingUser.id}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {actionLoading === pendingUser.id ? '...' : 'Aprovar'}
                      </Button>
                      <Button
                        onClick={() => handleReject(pendingUser.id)}
                        disabled={actionLoading === pendingUser.id}
                        size="sm"
                        variant="destructive"
                      >
                        {actionLoading === pendingUser.id ? '...' : 'Rejeitar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t">
              <h4 className="font-semibold mb-2">Link de Aprovação por Email</h4>
              <p className="text-sm text-gray-600 mb-2">
                Pode partilhar estes links com os administradores para aprovação via email:
              </p>
              {pendingUsers.length > 0 && (
                <div className="space-y-2">
                  {pendingUsers.map((pendingUser) => (
                    <div key={pendingUser.id} className="p-2 bg-gray-100 rounded text-sm">
                      <p className="font-medium">{pendingUser.email}</p>
                      {pendingUser.approval_token && (
                        <p className="text-xs text-gray-600 break-all mt-1">
                          {window.location.origin}/api/auth/approve/{pendingUser.approval_token}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'all' && (
          <>
            <h3 className="font-semibold mb-4">Todos os Utilizadores</h3>

            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : allUsers.length === 0 ? (
              <p className="text-gray-600 text-center py-4">Sem utilizadores registados</p>
            ) : (
              <div className="space-y-3">
                {allUsers.map((allUser) => (
                  <div
                    key={allUser.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      allUser.role === 'admin' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{allUser.email}</p>
                        {allUser.role === 'admin' && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            Admin
                          </span>
                        )}
                        {allUser.status === 'pending' && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                            Pendente
                          </span>
                        )}
                        {allUser.status === 'rejected' && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            Rejeitado
                          </span>
                        )}
                        {allUser.has_pending_reset && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded flex items-center">
                            🔑 Reset Pendente
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Registado em: {new Date(allUser.created_at).toLocaleDateString('pt-PT')}
                      </p>
                      {allUser.last_login && (
                        <p className="text-sm text-gray-500">
                          Último login: {new Date(allUser.last_login).toLocaleDateString('pt-PT')}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {allUser.role !== 'admin' && allUser.status === 'approved' && (
                        <Button
                          onClick={() => handlePromote(allUser.id)}
                          disabled={actionLoading === allUser.id}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          {actionLoading === allUser.id ? '...' : 'Promover'}
                        </Button>
                      )}
                      {allUser.role === 'admin' && allUser.id !== user?.id && (
                        <Button
                          onClick={() => handleDemote(allUser.id)}
                          disabled={actionLoading === allUser.id}
                          size="sm"
                          variant="outline"
                        >
                          {actionLoading === allUser.id ? '...' : 'Despromover'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'password-reset' && (
          <>
            <h3 className="font-semibold mb-4">Pedidos de Reset de Password</h3>

            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : passwordResetRequests.length === 0 ? (
              <p className="text-gray-600 text-center py-4">Sem pedidos de reset pendentes</p>
            ) : (
              <div className="space-y-3">
                {passwordResetRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{request.email}</p>
                      <p className="text-sm text-gray-600">
                        Pedido em: {new Date(request.requested_at).toLocaleString('pt-PT')}
                      </p>
                      <p className="text-sm text-gray-500">
                        Role: {request.user_role}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleApproveResetRequest(request.id)}
                        disabled={actionLoading === request.id}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {actionLoading === request.id ? '...' : 'Aprovar'}
                      </Button>
                      <Button
                        onClick={() => handleRejectResetRequest(request.id)}
                        disabled={actionLoading === request.id}
                        size="sm"
                        variant="destructive"
                      >
                        {actionLoading === request.id ? '...' : 'Rejeitar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'logs' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Logs do Sistema</h3>
              <Button onClick={handleClearLogs} variant="destructive" size="sm">
                Limpar Logs Antigos
              </Button>
            </div>
            <div className="flex gap-2 mb-4">
              <Button
                onClick={() => setLogFilter('all')}
                variant={logFilter === 'all' ? 'default' : 'outline'}
                size="sm"
              >
                Todos
              </Button>
              <Button
                onClick={() => setLogFilter('error')}
                variant={logFilter === 'error' ? 'default' : 'outline'}
                size="sm"
              >
                Erros
              </Button>
              <Button
                onClick={() => setLogFilter('warning')}
                variant={logFilter === 'warning' ? 'default' : 'outline'}
                size="sm"
              >
                Avisos
              </Button>
              <Button
                onClick={() => setLogFilter('info')}
                variant={logFilter === 'info' ? 'default' : 'outline'}
                size="sm"
              >
                Info
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-gray-600 text-center py-4">Nenhum log encontrado com o filtro atual.</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      expandedLog === log.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getLevelColor(log.level)}`}>
                            {log.level.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDate(log.created_at)}
                          </span>
                          {log.route && (
                            <span className="text-sm text-gray-600">
                              {log.method} {log.route}
                            </span>
                          )}
                          {log.user_id && (
                            <span className="text-sm text-gray-600">
                              User ID: {log.user_id}
                            </span>
                          )}
                        </div>
                        <div className="text-gray-800 font-medium">
                          {log.message}
                        </div>
                      </div>
                      <div className="ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedLog(expandedLog === log.id ? null : log.id);
                          }}
                        >
                          {expandedLog === log.id ? '▲' : '▼'}
                        </Button>
                      </div>
                    </div>
                    
                    {expandedLog === log.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {log.details && (
                          <div className="mb-3">
                            <div className="text-sm font-medium text-gray-700 mb-1">Detalhes:</div>
                            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.ip_address && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">IP:</span> {log.ip_address}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'config' && (
          <>
            <h3 className="font-semibold mb-4">Configuração de Email</h3>

            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : emailConfig ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${emailConfig.configured ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                  <div className="flex items-center space-x-2">
                    <span className={`text-lg ${emailConfig.configured ? 'text-green-600' : 'text-red-600'}`}>
                      {emailConfig.configured ? '✓' : '✗'}
                    </span>
                    <span className="font-medium">
                      {emailConfig.configured ? 'Email configurado' : 'Email não configurado'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">SendGrid</div>
                    <div className={`font-medium ${emailConfig.sendgrid ? 'text-green-600' : 'text-gray-400'}`}>
                      {emailConfig.sendgrid ? 'Configurado' : 'Não configurado'}
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">SMTP</div>
                    <div className={`font-medium ${emailConfig.smtp ? 'text-green-600' : 'text-gray-400'}`}>
                      {emailConfig.smtp ? 'Configurado' : 'Não configurado'}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Frontend URL</div>
                  <div className="font-medium text-sm">{emailConfig.frontendUrl}</div>
                </div>

                {!emailConfig.configured && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">Como configurar email:</h4>
                    <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                      <li>Configure SENDGRID_API_KEY e SENDGRID_FROM_EMAIL no Render</li>
                      <li>OU configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM</li>
                      <li>Verifique se FRONTEND_URL está configurado corretamente</li>
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">Não foi possível carregar a configuração</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
