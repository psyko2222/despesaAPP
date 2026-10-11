import React from 'react';
import { Button } from './ui/button';
import { Bell, Check, X, AlertCircle, Database, CheckCircle2, Trash2, Target, Sparkles } from 'lucide-react';

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
}

export function NotificationsModal({ isOpen, onClose, notifications = [], onMarkAsRead }: NotificationsModalProps) {
  if (!isOpen) return null;

  const list = Array.isArray(notifications) ? notifications : [];

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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-1">
          <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">
            <Bell className="w-5 h-5 text-primary-600" />
            Notificações
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Lembretes de débitos, avisos de cópias de segurança e alertas do sistema.
        </p>

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
              return (
                <div 
                  key={notif.id} 
                  className={`p-3 rounded-xl border text-sm transition-colors ${
                    isUnread 
                      ? 'bg-primary-50/60 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800/80 shadow-xs' 
                      : 'bg-white dark:bg-gray-800/60 border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      {getIcon(notif.type)}
                      <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 leading-tight">
                        {notif.title}
                      </h4>
                    </div>
                    {isUnread && (
                      <button 
                        onClick={() => onMarkAsRead([notif.id])} 
                        className="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-xs flex items-center gap-1 font-semibold flex-shrink-0" 
                        title="Marcar como lida"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed pl-6">
                    {notif.message}
                  </p>
                  <div className="flex justify-between items-center pl-6 mt-2 pt-1 border-t border-gray-100/60 dark:border-gray-700/60 text-[10px] text-gray-400">
                    <span>{new Date(notif.created_at).toLocaleString('pt-PT')}</span>
                    {isUnread && (
                      <span className="font-semibold text-primary-600 dark:text-primary-400">Nova</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
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
