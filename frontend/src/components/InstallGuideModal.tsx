'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Monitor, Smartphone, Download, CheckCircle2, Sparkles } from 'lucide-react';

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall?: () => void;
  canInstallDirectly?: boolean;
}

type PlatformTab = 'desktop' | 'android' | 'ios';

export function InstallGuideModal({
  isOpen,
  onClose,
  onInstall,
  canInstallDirectly = false,
}: InstallGuideModalProps) {
  const [activeTab, setActiveTab] = useState<PlatformTab>('desktop');

  // Detetar automaticamente o sistema do utilizador ao abrir
  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        setActiveTab('ios');
      } else if (/android/.test(ua)) {
        setActiveTab('android');
      } else {
        setActiveTab('desktop');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('has_seen_install_guide', 'true');
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200"
      onClick={handleDismiss}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-primary-50/50 dark:bg-primary-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-md shadow-primary-600/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
                Instalar Aplicação
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Funciona como um programa ou app nativa
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm">
          
          {/* Seletor de Plataforma */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('desktop')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'desktop'
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>PC / Mac</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'android'
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'ios'
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>iPhone/iPad</span>
            </button>
          </div>

          {/* Botão de instalação direta (se disponível pelo browser) */}
          {canInstallDirectly && onInstall && (
            <div className="p-3 bg-primary-50 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-primary-800 dark:text-primary-300 font-semibold text-xs">
                <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400 animate-pulse" />
                <span>Instalação rápida disponível no seu navegador:</span>
              </div>
              <Button
                type="button"
                onClick={() => {
                  onInstall();
                  handleDismiss();
                }}
                className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-sm font-semibold shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Instalar Agora com 1 Clique</span>
              </Button>
            </div>
          )}

          {/* Guia: PC (Windows / Mac) */}
          {activeTab === 'desktop' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Instruções para Google Chrome & Microsoft Edge
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    <strong className="text-gray-900 dark:text-gray-100">Barra de Endereço:</strong> Olhe para o canto superior direito da barra onde está o link (<code className="text-primary-600 dark:text-primary-400">despesa-app...</code>).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Clique no ícone de <strong>instalação</strong> (um pequeno ecrã com seta para baixo ⬇️) ou no botão <strong>"Instalar"</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Clique em <strong>"Instalar"</strong>. A app abrirá numa janela própria com atalho no <strong>Ambiente de Trabalho</strong> e na <strong>Barra de Tarefas</strong>.
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                💡 <strong>Em alternativa:</strong> Clique no menu dos 3 pontos do Chrome (<strong>⋮</strong>) &gt; <strong>Guardar e partilhar</strong> &gt; <strong>Instalar Despesas...</strong>
              </div>
            </div>
          )}

          {/* Guia: Android */}
          {activeTab === 'android' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Instruções para Google Chrome no Android
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    No Google Chrome, toque no menu dos <strong>3 pontinhos verticais (⋮)</strong> no canto superior direito.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Selecione a opção <strong>"Instalar aplicação"</strong> (ou <em>"Adicionar ao ecrã principal"</em>).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Confirme em <strong>"Instalar"</strong>. A aplicação ficará guardada na lista de aplicações do telemóvel com o seu próprio ícone.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Guia: iPhone / iPad */}
          {activeTab === 'ios' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Instruções para Safari no iOS (iPhone / iPad)
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Abra o site no navegador oficial <strong>Safari</strong> da Apple.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Toque no botão de <strong>Partilha</strong> (o ícone de quadrado com uma seta para cima ⬆️ na barra inferior).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Deslize para baixo e toque em <strong>"Ecrã principal"</strong> (ou <em>"Adicionar ao Ecrã Principal"</em> ➕) e confirme em <strong>Adicionar</strong>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vantagens */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>Sem barras de navegação, ecrã inteiro e notificações ativas.</span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 hidden sm:block">
            Pode rever estas instruções em <strong>Definições &gt; Aplicação</strong>
          </p>
          <Button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto px-6 ml-auto"
          >
            Entendido
          </Button>
        </div>

      </div>
    </div>
  );
}

