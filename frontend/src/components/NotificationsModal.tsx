import React from 'react';
import { Button } from './ui/button';
import { 
  Bell, 
  Check, 
  X, 
  AlertCircle, 
  Database, 
  CheckCircle2, 
  Trash2, 
  Target, 
  Sparkles,
  CheckCheck,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { Tab } from './BottomNav';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (ids?: number[]) => void;
  onNavigate?: (tab: Tab) => void;
}

export function NotificationsModal({ 
  isOpen, 
  onClose, 
  notifications = [], 
  onMarkAsRead,
  onNavigate 
}: NotificationsModalProps) {
  if (!isOpen) return null;

  const list = Array.isArray(notifications) ? notifications : [];
  const unreadCount = list.filter(n => Number(n.is_read) === 0).length;

  const getTargetInfo = (notif: Notification): { tab: Tab; label: string } => {
    const type = (notif.type || '').toLowerCase();
    const text = `${notif.title || ''} ${notif.message || ''}`.toLowerCase();

    if (type.includes('saving') || text.includes('poupança') || text.includes('poupanca') || text.includes('meta')) {
      return { tab: 'savings', label: 'Poupanças' };
    }
    if (type.includes('backup') || text.includes('backup') || text.includes('cópia de segurança') || text.includes('copia de seguranca')) {
      return { tab: 'settings', label: 'Definições' };
    }
    if (type.includes('share') || text.includes('partilh') || text.includes('convite')) {
      return { tab: 'settings', label: 'Partilhas' };
    }
    if (type.includes('admin')) {
      return { tab: 'admin', label: 'Admin' };
    }
    if (type.includes('stat') || text.includes('estatístic') || text.includes('estatistica')) {
      return { tab: 'stats', label: 'Estatísticas' };
    }
    return { tab: 'month', label: 'Despesas do Mês' };
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
      case 'saving_goal':
      case 'goal':
        return <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      case 'saving_deadline':
        return <Target className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      case 'backup':
        return <Database className="w-4 h-4 text-blue-500 flex-shrink-0" />;
      default:
        return <Bell className="w-4 h-4 text-primary-500 flex-shrink-0" />;
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (Number(notif.is_read) === 0) {
      onMarkAsRead([notif.id]);
    }
    const { tab } = getTargetInfo(notif);
    if (onNavigate) {
      onNavigate(tab);
    }
    onClose();
  };

  const handleMarkAllRead = () => {
    onMarkAsRead();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5 flex flex-col max-h-[85vh]">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">
              <Bell className="w-5 h-5 text-primary-600" />
              Notificações
            </h2>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount} novas
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs h-8 px-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 flex items-center gap-1 font-semibold"
                title="Marcar todas as notificações como lidas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Ler todas</span>
              </Button>
            )}
            <button 
              onClick={onClose} 
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Clique numa notificação para abrir a secção correspondente.
        </p>

        {/* Lista de Notificações */}
        <div className="space-y-2.5 overflow-y-auto pr-1 scrollbar-thin flex-1">
          {list.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Não tem notificações.</p>
              <p className="text-xs text-gray-400">Os lembretes diários e avisos automáticos vão aparecer aqui.</p>
            </div>
          ) : (
            list.map(notif => {
              const isUnread = Number(notif.is_read) === 0;
              const targetInfo = getTargetInfo(notif);

              return (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationClick(notif)}
                  role="button"
                  tabIndex={0}
                  className={`p-3 rounded-xl border text-sm transition-all cursor-pointer group text-left ${
                    isUnread 
                      ? 'bg-primary-50/70 dark:bg-primary-950/40 border-primary-300 dark:border-primary-800 hover:border-primary-500 hover:shadow-xs' 
                      : 'bg-white dark:bg-gray-800/60 border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      {getIcon(notif.type)}
                      <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {notif.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isUnread && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead([notif.id]);
                          }} 
                          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-xs p-1 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/40 flex items-center gap-1 font-semibold" 
                          title="Marcar apenas esta como lida"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed pl-6">
                    {notif.message}
                  </p>

                  <div className="flex justify-between items-center pl-6 mt-2 pt-1 border-t border-gray-100/60 dark:border-gray-700/60 text-[10px] text-gray-400">
                    <span>{new Date(notif.created_at).toLocaleString('pt-PT')}</span>
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="font-semibold text-primary-600 dark:text-primary-400">Nova</span>
                      )}
                      <span className="inline-flex items-center gap-0.5 text-primary-600 dark:text-primary-400 font-medium group-hover:underline">
                        <span>Ir para {targetInfo.label}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-4 flex justify-between items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          {unreadCount > 0 ? (
            <Button 
              onClick={handleMarkAllRead} 
              variant="outline" 
              size="sm" 
              className="text-xs text-primary-600 dark:text-primary-400 border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 flex items-center gap-1.5 font-semibold"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar todas como lidas
            </Button>
          ) : (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
              Todas as notificações lidas
            </span>
          )}

          <Button 
            onClick={onClose} 
            variant="outline" 
            size="sm" 
            className="text-xs"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
