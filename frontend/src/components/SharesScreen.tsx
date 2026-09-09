'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sharesAPI } from '@/lib/api';
import { AccountShare, SharesResponse } from '@/types';

export function SharesScreen() {
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
      alert('Convite enviado com sucesso!');
      loadShares();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await sharesAPI.acceptInvitation(id);
      alert('Partilha aceite com sucesso!');
      loadShares();
    } catch (error) {
      alert('Erro ao aceitar partilha');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await sharesAPI.rejectInvitation(id);
      alert('Partilha rejeitada');
      loadShares();
    } catch (error) {
      alert('Erro ao rejeitar partilha');
    }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm('Tem a certeza que deseja revogar esta partilha?')) return;

    try {
      await sharesAPI.revokeShare(id);
      alert('Partilha revogada com sucesso!');
      loadShares();
    } catch (error) {
      alert('Erro ao revogar partilha');
    }
  };

  const handleLeave = async (id: number) => {
    if (!confirm('Tem a certeza que deseja sair desta partilha?')) return;

    try {
      await sharesAPI.leaveShare(id);
      alert('Saiu da partilha com sucesso!');
      loadShares();
    } catch (error) {
      alert('Erro ao sair da partilha');
    }
  };

  const tabs = ['Convites', 'As Minhas Partilhas', 'Partilhas Comigo'];

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">A carregar partilhas...</p>
      </div>
    );
  }

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
        <Card>
          <CardHeader>
            <CardTitle>Convites Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-gray-600 text-center py-4">Sem convites pendentes</p>
            ) : (
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="flex justify-between items-center p-4 border rounded">
                    <div>
                      <p className="font-medium">{invitation.owner_email}</p>
                      <p className="text-sm text-gray-600">
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
              <label className="block text-gray-700 mb-1">Email</label>
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

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-3">Partilhas Ativas</h3>
              {activeShares?.sent.length === 0 ? (
                <p className="text-gray-600 text-center py-4">Sem partilhas ativas</p>
              ) : (
                <div className="space-y-3">
                  {activeShares?.sent.map((share) => (
                    <div key={share.id} className="flex justify-between items-center p-4 border rounded">
                      <div>
                        <p className="font-medium">{share.shared_with_email}</p>
                        <p className="text-sm text-gray-600">
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
              <p className="text-gray-600 text-center py-4">Ninguém partilhou a conta contigo</p>
            ) : (
              <div className="space-y-3">
                {activeShares?.received.map((share) => (
                  <div key={share.id} className="flex justify-between items-center p-4 border rounded">
                    <div>
                      <p className="font-medium">{share.owner_email}</p>
                      <p className="text-sm text-gray-600">
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