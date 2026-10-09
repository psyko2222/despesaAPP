import React from 'react';
import { Button } from './ui/button';
import { Bell, Check, X } from 'lucide-react';

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

export function NotificationsModal({ isOpen, onClose, notifications, onMarkAsRead }: NotificationsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md p-5 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-200">
            <Bell className="w-5 h-5 text-primary-600" />
            Notificações
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Alertas sobre cópias de segurança e do sistema.
        </p>

        <div className="space-y-3 overflow-y-auto pr-1 scrollbar-thin">
          {notifications.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              Não tem notificações novas.
            </div>
          ) : (
            notifications.map(notif => (
              <div 
                key={notif.id} 
                className={`p-3 rounded-lg border text-sm ${notif.is_read === 0 ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200">{notif.title}</h4>
                  {notif.is_read === 0 && (
                    <button onClick={() => onMarkAsRead([notif.id])} className="text-primary-600 hover:text-primary-700" title="Marcar como lida">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{notif.message}</p>
                <span className="text-[10px] text-gray-400 mt-2 block">
                  {new Date(notif.created_at).toLocaleString('pt-PT')}
                </span>
              </div>
            ))
          )}
        </div>

        {notifications.some(n => n.is_read === 0) && (
          <div className="mt-4 flex justify-end pt-2 border-t border-gray-200 dark:border-gray-800">
            <Button onClick={() => onMarkAsRead()} variant="outline" className="text-xs">
              Marcar todas como lidas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

