'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sharesAPI } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { AccountShare, SharesResponse } from '@/types';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Eye, 
  Pencil, 
  Trash2, 
  Lock, 
  X, 
  Check, 
  Mail, 
  ShieldAlert,
  Sliders
} from 'lucide-react';

export function SharesScreen() {
  const toast = useToast();
  const [invitations, setInvitations] = useState<AccountShare[]>([]);
  const [activeShares, setActiveShares] = useState<SharesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Convite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCanWrite, setInviteCanWrite] = useState(true);
  const [inviteCanDelete, setInviteCanDelete] = useState(true);
  const [inviting, setInviting] = useState(false);
  
  // Tab selecionada
  const [activeTab, setActiveTab] = useState(0);

  // Modal de Edição de Permissões
  const [editingShare, setEditingShare] = useState<AccountShare | null>(null);
  const [editCanWrite, setEditCanWrite] = useState(true);
  const [editCanDelete, setEditCanDelete] = useState(true);
  const [savingPermissions, setSavingPermissions] = useState(false);

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
    if (!inviteEmail.trim()) {
      toast.error('Por favor indique um email válido');
      return;
    }

    setInviting(true);
    try {
      await sharesAPI.invite(inviteEmail.trim(), {
        can_read: true,
        can_write: inviteCanWrite,
        can_delete: inviteCanDelete
      });
      setInviteEmail('');
      toast.success('Convite enviado com sucesso!');
      loadShares();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  };

  const handleOpenEditPermissions = (share: AccountShare) => {
    setEditingShare(share);
    setEditCanWrite(share.can_write === 1);
    setEditCanDelete(share.can_delete === 1);
  };

  const handleSavePermissions = async () => {
    if (!editingShare) return;
    setSavingPermissions(true);
    try {
      await sharesAPI.updatePermissions(editingShare.id, {
        can_read: true,
        can_write: editCanWrite,
        can_delete: editCanDelete
      });
      toast.success('Permissões atualizadas com sucesso!');
      setEditingShare(null);
      loadShares();
    } catch (error: any) {
      console.error('Erro ao atualizar permissões:', error);
      toast.error(error.response?.data?.error || 'Erro ao atualizar permissões');
    } finally {
      setSavingPermissions(false);
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
    if (!confirm('Tem a certeza que deseja revogar esta partilha? O utilizador deixará de ter acesso à sua conta.')) return;

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

  const tabs = [
    { label: 'Convites', count: invitations.length },
    { label: 'As Minhas Partilhas', count: activeShares?.sent.length || 0 },
    { label: 'Partilhas Comigo', count: activeShares?.received.length || 0 }
  ];

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
            key={tab.label}
            type="button"
            onClick={() => setActiveTab(index)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
              activeTab === index
                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === index ? 'bg-white/25 text-white' : 'bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 0: Convites Pendentes */}
      {activeTab === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary-600" />
              Convites Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                Não tem convites pendentes de outros utilizadores.
              </div>
            ) : (
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-800 gap-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{invitation.owner_email}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Convidou-o para aceder à respetiva conta (despesas, regulares e poupanças).
                      </p>
                    </div>
                    <div className="flex space-x-2 w-full sm:w-auto justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(invitation.id)}
                      >
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
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

      {/* Tab 1: As Minhas Partilhas */}
      {activeTab === 1 && (
        <div className="space-y-4">
          {/* Card para Enviar Novo Convite */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-600" />
                Convidar Alguém para a Minha Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 mb-1">
                  Email do Utilizador
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
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
                    className="flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <UserPlus className="w-4 h-4" />
                    {inviting ? 'A enviar...' : 'Enviar Convite'}
                  </Button>
                </div>
              </div>

              {/* Configuração de Permissões Iniciais do Convite */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2.5">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Permissões Iniciais para este utilizador:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteCanWrite}
                      onChange={(e) => setInviteCanWrite(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 block">Pode Criar e Editar</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">Adicionar despesas, poupanças e movimentos</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteCanDelete}
                      onChange={(e) => setInviteCanDelete(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 block">Pode Eliminar / Apagar</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">Apagar despesas, poupanças e anulações</span>
                    </div>
                  </label>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                  * A permissão de leitura é sempre incluída para o utilizador poder visualizar os dados. Pode alterar estas permissões a qualquer momento abaixo.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Partilhas Ativas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Partilhas Ativas da Minha Conta
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeShares?.sent.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  Ainda não partilhou a sua conta com nenhum outro utilizador.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeShares?.sent.map((share) => (
                    <div 
                      key={share.id} 
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 shadow-xs gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                            {share.shared_with_email}
                          </p>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            Ativa
                          </span>
                        </div>

                        {/* Badges de Permissões Atuais */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                            <Eye className="w-3 h-3 text-blue-600" />
                            Ver (Leitura)
                          </span>

                          {share.can_write === 1 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <Pencil className="w-3 h-3 text-emerald-600" />
                              Pode Editar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                              <Lock className="w-3 h-3 text-gray-400" />
                              Sem Edição
                            </span>
                          )}

                          {share.can_delete === 1 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                              <Trash2 className="w-3 h-3 text-amber-600" />
                              Pode Apagar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                              <Lock className="w-3 h-3 text-gray-400" />
                              Sem Eliminação
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditPermissions(share)}
                          className="h-8 text-xs font-semibold flex items-center gap-1.5 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          Editar Permissões
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRevoke(share.id)}
                          className="h-8 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Revogar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Contas Partilhadas Comigo */}
      {activeTab === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              Contas Partilhadas Comigo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeShares?.received.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                Nenhum utilizador partilhou a respetiva conta consigo até ao momento.
              </div>
            ) : (
              <div className="space-y-3">
                {activeShares?.received.map((share) => (
                  <div key={share.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 shadow-xs gap-3">
                    <div className="space-y-1.5">
                      <p className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                        {share.owner_email}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                          <Eye className="w-3 h-3 text-blue-600" />
                          Ver (Leitura)
                        </span>

                        {share.can_write === 1 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <Pencil className="w-3 h-3 text-emerald-600" />
                            Pode Adicionar/Editar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                            <Lock className="w-3 h-3 text-amber-600" />
                            Apenas Leitura
                          </span>
                        )}

                        {share.can_delete === 1 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <Trash2 className="w-3 h-3 text-emerald-600" />
                            Pode Apagar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                            <Lock className="w-3 h-3 text-gray-400" />
                            Sem Permissão para Apagar
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleLeave(share.id)}
                      className="self-end sm:self-auto h-8 text-xs font-semibold"
                    >
                      Sair da Partilha
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de Edição de Permissões */}
      {editingShare && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary-50 dark:bg-primary-950/60 text-primary-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">
                    Editar Permissões
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {editingShare.shared_with_email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingShare(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Leitura (Sempre ativa) */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 opacity-60"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">
                    Visualização / Leitura (Obrigatório)
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Permite ao utilizador consultar despesas, despesas regulares, estatísticas e poupanças.
                  </p>
                </div>
              </div>

              {/* Escrita / Edição */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                <input
                  type="checkbox"
                  checked={editCanWrite}
                  onChange={(e) => setEditCanWrite(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">
                    Permitir Criar e Editar (Escrita)
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Permite criar novas despesas, editar valores/datas e adicionar ou retirar saldo às poupanças. Se desativado, o utilizador apenas consegue ver os registos.
                  </p>
                </div>
              </label>

              {/* Eliminação */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                <input
                  type="checkbox"
                  checked={editCanDelete}
                  onChange={(e) => setEditCanDelete(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">
                    Permitir Apagar / Eliminar
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Permite remover despesas da conta, apagar poupanças ou cancelar movimentos registados.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingShare(null)}
                disabled={savingPermissions}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingPermissions}
                className="bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {savingPermissions ? 'A guardar...' : 'Guardar Permissões'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}