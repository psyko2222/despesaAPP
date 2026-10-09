import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Bell, Check } from 'lucide-react';

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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-11/12 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-600" />
            Notificações
          </DialogTitle>
          <DialogDescription>
            Alertas sobre cópias de segurança e do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
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
          <div className="mt-4 flex justify-end">
            <Button onClick={() => onMarkAsRead()} variant="outline" className="text-xs">
              Marcar todas como lidas
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
