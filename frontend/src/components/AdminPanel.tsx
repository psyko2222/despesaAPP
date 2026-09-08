'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';

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
}

export function AdminPanel() {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    if (user?.role === 'admin') {
      loadPendingUsers();
      loadAllUsers();
    }
  }, [user]);

  const loadPendingUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/users/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllUsers(response.data);
    } catch (error) {
      console.error('Failed to load all users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: number) => {
    setActionLoading(userId);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/admin/users/${userId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('token');
      await axios.post(`/api/admin/users/${userId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('token');
      await axios.post(`/api/admin/users/${userId}/promote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('token');
      await axios.post(`/api/admin/users/${userId}/demote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('token');
      await axios.delete(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Utilizador apagado com sucesso!');
      loadAllUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Erro ao apagar utilizador');
    } finally {
      setActionLoading(null);
    }
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
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Pendentes ({pendingUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Todos os Utilizadores ({allUsers.length})
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
      </CardContent>
    </Card>
  );
}
