'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sharesAPI } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { AccountShare, SharesResponse } from '@/types';

export function SharesScreen() {
  const toast = useToast();
  const [invitations, setInvitations] = useState<AccountShare[]>([]);
  const [activeShares, setActiveShares] = useState<SharesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    loadShares();
  }, []);

  const loadShares = async () => {
    setLoading(true);
    try {
      const [invitationsData, activeData] = await Promise.all([
        sharesAPI.getInvitations(),
        sharesAPI.getActiveShares()
      ]);
      setInvitations(invitationsData.data);
      setActiveShares(activeData.data);
    } catch (error) {
      console.error('Failed to load shares:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      await sharesAPI.invite(inviteEmail);
      setInviteEmail('');
      toast.success('Convite enviado com sucesso!');
      loadShares();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await sharesAPI.acceptInvitation(id);
      toast.success('Partilha aceite com sucesso!');
      loadShares();
    } catch (error) {
      toast.error('Erro ao aceitar partilha');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await sharesAPI.rejectInvitation(id);
      toast.info('Partilha rejeitada');
      loadShares();
    } catch (error) {
      toast.error('Erro ao rejeitar partilha');
    }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm('Tem a certeza que deseja revogar esta partilha?')) return;

    try {
      await sharesAPI.revokeShare(id);
      toast.success('Partilha revogada com sucesso!');
      loadShares();
    } catch (error) {
      toast.error('Erro ao revogar partilha');
    }
  };

  const handleLeave = async (id: number) => {
    if (!confirm('Tem a certeza que deseja sair desta partilha?')) return;

    try {
      await sharesAPI.leaveShare(id);
      toast.success('Saiu da partilha com sucesso!');
      loadShares();
    } catch (error) {
      toast.error('Erro ao sair da partilha');
    }
  };

  const tabs = ['Convites', 'As Minhas Partilhas', 'Partilhas Comigo'];

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">A carregar partilhas...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(index)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === index
                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convites Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-4">Sem convites pendentes</p>
            ) : (
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-800/40">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{invitation.owner_email}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Convidou-te a partilhar a conta
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => handleReject(invitation.id)}
                      >
                        Rejeitar
                      </Button>
                      <Button
                        onClick={() => handleAccept(invitation.id)}
                      >
                        Aceitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Convidar Alguém</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <div className="flex space-x-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="flex-1"
                />
                <Button
                  onClick={handleInvite}
                  disabled={inviting}
                >
                  {inviting ? 'A enviar...' : 'Convidar'}
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Partilhas Ativas</h3>
              {activeShares?.sent.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-center py-4">Sem partilhas ativas</p>
              ) : (
                <div className="space-y-3">
                  {activeShares?.sent.map((share) => (
                    <div key={share.id} className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-800/40">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{share.shared_with_email}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Permissões: {share.can_read ? 'Ler' : ''} {share.can_write ? 'Escrever' : ''} {share.can_delete ? 'Apagar' : ''}
                        </p>
                      </div>
                      <Button
                        variant="danger"
                        onClick={() => handleRevoke(share.id)}
                      >
                        Revogar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Contas Partilhadas Comigo</CardTitle>
          </CardHeader>
          <CardContent>
            {activeShares?.received.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-4">Ninguém partilhou a conta contigo</p>
            ) : (
              <div className="space-y-3">
                {activeShares?.received.map((share) => (
                  <div key={share.id} className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-800/40">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{share.owner_email}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Permissões: {share.can_read ? 'Ler' : ''} {share.can_write ? 'Escrever' : ''} {share.can_delete ? 'Apagar' : ''}
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      onClick={() => handleLeave(share.id)}
                    >
                      Sair
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}