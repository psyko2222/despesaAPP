'use client';

import React from 'react';
import { Home, Repeat, BarChart3, Users, Settings, Shield } from 'lucide-react';

export type Tab = 'month' | 'regular' | 'stats' | 'shares' | 'settings' | 'admin';

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  pendingInvitations?: number;
  isAdmin?: boolean;
}

export function BottomNav({
  activeTab,
  setActiveTab,
  pendingInvitations = 0,
  isAdmin = false
}: BottomNavProps) {
  const tabs = [
    { id: 'month' as Tab, label: 'Mês', icon: Home },
    { id: 'regular' as Tab, label: 'Regulares', icon: Repeat },
    { id: 'stats' as Tab, label: 'Estatísticas', icon: BarChart3 },
    { id: 'shares' as Tab, label: 'Partilhas', icon: Users, badge: pendingInvitations },
    { id: 'settings' as Tab, label: 'Definições', icon: Settings },
    ...(isAdmin ? [{ id: 'admin' as Tab, label: 'Admin', icon: Shield }] : [])
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-1 px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] transition-colors">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 relative rounded-lg transition-colors select-none ${
                isActive
                  ? 'text-primary-600 dark:text-primary-400 font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1 truncate max-w-[56px]">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

