'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Eye, 
  Database, 
  Cloud, 
  FileText, 
  Upload, 
  Download, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Lock, 
  RefreshCw, 
  ArrowLeft, 
  Filter, 
  ShieldCheck, 
  X,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { adminAPI } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface GoogleDriveBackupFile {
  id: string;
  name: string;
  folder: string;
  size: number;
  createdTime: string;
  modifiedTime?: string;
}

interface BackupExpense {
  id?: number;
  description: string;
  amount_cents?: number;
  amount?: number;
  debit_date: string;
  paid?: number | boolean;
  recurring?: number | boolean;
  fixed_amount?: number | boolean;
  recurrence_months?: number;
  is_private?: number;
  series_id?: number | null;
  created_at?: string;
}

interface BackupData {
  format_version?: number;
  type?: string;
  cleanup_years?: number;
  start_date?: string;
  end_date?: string;
  exported_at?: string;
  user_id?: number;
  user_email?: string;
  total_expenses?: number;
  expenses: BackupExpense[];
  settings?: any;
}

export function AdminBackupViewer() {
  const toast = useToast();
  const { user } = useAuth();
  const isPrivateAdmin = user?.role === 'admin_private';

  const [activeSourceTab, setActiveSourceTab] = useState<'drive' | 'file' | 'system'>('drive');
  const [googleFiles, setGoogleFiles] = useState<GoogleDriveBackupFile[]>([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  
  // Backup carregado para visualização em memória
  const [selectedBackup, setSelectedBackup] = useState<BackupData | null>(null);
  const [backupTitle, setBackupTitle] = useState<string>('');
  const [loadingFileContent, setLoadingFileContent] = useState(false);

  // Filtros de pesquisa na visualização do backup
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterRecurring, setFilterRecurring] = useState<'all' | 'recurring' | 'single'>('all');
  const [filterType, setFilterType] = useState<'all' | 'fixed' | 'variable'>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'description'>('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Visualização de Definições
  const [showSettings, setShowSettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar ficheiros do Google Drive ao abrir
  useEffect(() => {
    loadGoogleBackups();
  }, []);

  const loadGoogleBackups = async () => {
    setLoadingGoogle(true);
    try {
      const res = await adminAPI.getGoogleBackups();
      setGoogleConnected(res.data.connected);
      setGoogleFiles(res.data.files || []);
    } catch (err: any) {
      console.error('Erro ao carregar ficheiros do Google Drive:', err);
      setGoogleConnected(false);
      toast.error('Não foi possível aceder aos ficheiros do Google Drive');
    } finally {
      setLoadingGoogle(false);
    }
  };

  // Abrir backup do Google Drive
  const handleOpenGoogleBackup = async (file: GoogleDriveBackupFile) => {
    setLoadingFileContent(true);
    try {
      const res = await adminAPI.getGoogleBackupContent(file.id);
      if (res.data && res.data.backup) {
        setSelectedBackup(res.data.backup);
        setBackupTitle(`Google Drive (${file.folder}): ${file.name}`);
        setCurrentPage(1);
        toast.success(`Backup "${file.name}" carregado para consulta em modo de leitura.`);
      } else {
        toast.error('O ficheiro não contém dados de backup válidos.');
      }
    } catch (err: any) {
      console.error('Erro ao descarregar backup do Drive:', err);
      toast.error(err.response?.data?.error || 'Erro ao descarregar backup do Google Drive');
    } finally {
      setLoadingFileContent(false);
    }
  };

  // Carregar ficheiro JSON local do computador/telemóvel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && (Array.isArray(json.expenses) || Array.isArray(json))) {
          const formatted: BackupData = Array.isArray(json) 
            ? { expenses: json }
            : json;
          setSelectedBackup(formatted);
          setBackupTitle(`Ficheiro Local: ${file.name}`);
          setCurrentPage(1);
          toast.success(`Ficheiro local "${file.name}" carregado para visualização em memória.`);
        } else {
          toast.error('Formato de backup inválido (não foi encontrada a lista de despesas).');
        }
      } catch (err) {
        toast.error('Ficheiro JSON inválido ou corrompido.');
      }
    };
    reader.readAsText(file);
    // Limpar o input para permitir carregar o mesmo ficheiro novamente se necessário
    e.target.value = '';
  };

  // Carregar snapshot do utilizador atual (apenas para leitura)
  const handleLoadSystemSnapshot = async () => {
    setLoadingFileContent(true);
    try {
      const res = await adminAPI.getUserCurrentBackup();
      if (res.data && res.data.backup) {
        setSelectedBackup(res.data.backup);
        setBackupTitle(`Snapshot da Base de Dados Atual (Utilizador ID: ${res.data.backup.user_id})`);
        setCurrentPage(1);
        toast.success('Snapshot atual carregado para consulta em modo de leitura.');
      }
    } catch (err: any) {
      console.error('Erro ao carregar snapshot:', err);
      toast.error('Falha ao obter snapshot do utilizador');
    } finally {
      setLoadingFileContent(false);
    }
  };

  // Descarregar backup em JSON para o dispositivo
  const handleDownloadBackupJSON = () => {
    if (!selectedBackup) return;
    const blob = new Blob([JSON.stringify(selectedBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (backupTitle.split(':').pop()?.trim() || 'backup_consultado') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Obter meses únicos presentes no backup para o seletor de filtro
  const availableMonths = useMemo(() => {
    if (!selectedBackup || !selectedBackup.expenses) return [];
    const set = new Set<string>();
    selectedBackup.expenses.forEach(e => {
      if (e.debit_date) {
        const monthKey = e.debit_date.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(monthKey)) {
          set.add(monthKey);
        }
      }
    });
    return Array.from(set).sort().reverse();
  }, [selectedBackup]);

  // Lista filtrada e ordenada de despesas do backup
  const filteredExpenses = useMemo(() => {
    if (!selectedBackup || !selectedBackup.expenses) return [];
    let list = [...selectedBackup.expenses];

    // Ocultar privadas se não for admin_private
    if (!isPrivateAdmin) {
      list = list.filter(e => !e.is_private || e.is_private === 0);
    }

    // Pesquisa
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.description?.toLowerCase().includes(q));
    }

    // Filtro pago
    if (filterPaid === 'paid') {
      list = list.filter(e => e.paid === 1 || e.paid === true);
    } else if (filterPaid === 'unpaid') {
      list = list.filter(e => !e.paid || e.paid === 0 || e.paid === false);
    }

    // Filtro recorrente
    if (filterRecurring === 'recurring') {
      list = list.filter(e => e.recurring === 1 || e.recurring === true);
    } else if (filterRecurring === 'single') {
      list = list.filter(e => !e.recurring || e.recurring === 0 || e.recurring === false);
    }

    // Filtro fixa / variável
    if (filterType === 'fixed') {
      list = list.filter(e => e.fixed_amount === 1 || e.fixed_amount === true);
    } else if (filterType === 'variable') {
      list = list.filter(e => e.fixed_amount === 0 || e.fixed_amount === false);
    }

    // Filtro mês
    if (filterMonth !== 'all') {
      list = list.filter(e => e.debit_date?.startsWith(filterMonth));
    }

    // Ordenação
    list.sort((a, b) => {
      const amountA = a.amount_cents ?? ((a.amount || 0) * 100);
      const amountB = b.amount_cents ?? ((b.amount || 0) * 100);
      const dateA = a.debit_date || '';
      const dateB = b.debit_date || '';

      switch (sortBy) {
        case 'date_desc':
          return dateB.localeCompare(dateA);
        case 'date_asc':
          return dateA.localeCompare(dateB);
        case 'amount_desc':
          return amountB - amountA;
        case 'amount_asc':
          return amountA - amountB;
        case 'description':
          return (a.description || '').localeCompare(b.description || '');
        default:
          return 0;
      }
    });

    return list;
  }, [selectedBackup, searchQuery, filterPaid, filterRecurring, filterType, filterMonth, sortBy, isPrivateAdmin]);

  // Totais agregados do backup
  const stats = useMemo(() => {
    if (!selectedBackup || !selectedBackup.expenses) {
      return { totalCents: 0, count: 0, paidCents: 0, unpaidCents: 0, oldestDate: '', newestDate: '' };
    }
    const expenses = selectedBackup.expenses;
    let totalCents = 0;
    let paidCents = 0;
    let unpaidCents = 0;
    let oldestDate = '';
    let newestDate = '';

    expenses.forEach((e) => {
      if (!isPrivateAdmin && e.is_private === 1) return;
      const cents = e.amount_cents ?? Math.round((e.amount || 0) * 100);
      totalCents += cents;
      const isPaid = e.paid === 1 || e.paid === true;
      if (isPaid) paidCents += cents;
      else unpaidCents += cents;

      if (e.debit_date) {
        if (!oldestDate || e.debit_date < oldestDate) oldestDate = e.debit_date;
        if (!newestDate || e.debit_date > newestDate) newestDate = e.debit_date;
      }
    });

    return {
      totalCents,
      count: expenses.length,
      paidCents,
      unpaidCents,
      oldestDate,
      newestDate
    };
  }, [selectedBackup, isPrivateAdmin]);

  // Paginação
  const totalPages = Math.ceil(filteredExpenses.length / pageSize) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage]);

  return (
    <div className="space-y-5">
      {/* Banner de Segurança Estrito: Apenas Leitura */}
      <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-start gap-3 shadow-xs">
        <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-1.5">
            <span>Modo de Consulta Apenas Leitura (Auditoria)</span>
            <span className="text-[10px] bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-full font-bold">
              Sem Gravação
            </span>
          </h4>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
            Esta secção permite inspecionar ficheiros de backup (do Google Drive, ficheiros JSON ou backups automáticos de registos eliminados) estritamente para visualização. <strong>Nenhum dado é gravado nem substitui a base de dados em utilização.</strong>
          </p>
        </div>
      </div>

      {/* CASO 1: NENHUM BACKUP SELECIONADO - ESCOLHER FONTE */}
      {!selectedBackup && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-primary-600" />
              <span>Selecionar Backup para Consultar</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Abas de Origem do Backup */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 text-xs sm:text-sm font-semibold">
              <button
                type="button"
                onClick={() => setActiveSourceTab('drive')}
                className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeSourceTab === 'drive'
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Cloud className="w-4 h-4" />
                <span>Google Drive {googleFiles.length > 0 && `(${googleFiles.length})`}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSourceTab('file')}
                className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeSourceTab === 'file'
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Carregar Ficheiro JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSourceTab('system')}
                className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeSourceTab === 'system'
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Snapshot Atual do Sistema</span>
              </button>
            </div>

            {/* TAB: GOOGLE DRIVE */}
            {activeSourceTab === 'drive' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Backups guardados na pasta do Google Drive (inclui backups de registos eliminados)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={loadGoogleBackups}
                    disabled={loadingGoogle}
                    className="h-7 text-xs flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingGoogle ? 'animate-spin' : ''}`} />
                    <span>Atualizar</span>
                  </Button>
                </div>

                {loadingGoogle ? (
                  <div className="py-12 text-center text-sm text-gray-500 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
                    <span>A pesquisar backups no Google Drive...</span>
                  </div>
                ) : googleConnected === false ? (
                  <div className="p-6 text-center rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 space-y-2">
                    <Cloud className="w-10 h-10 text-gray-400 mx-auto" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      O Google Drive não está associado nesta conta.
                    </p>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      Pode associar o Google Drive no separador "Aplicação/Dados" das Definições ou utilizar a aba "Carregar Ficheiro JSON" para inspecionar ficheiros salvos no seu computador.
                    </p>
                  </div>
                ) : googleFiles.length === 0 ? (
                  <div className="py-10 text-center rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-dashed border-gray-200 dark:border-gray-800 text-sm text-gray-400 space-y-1">
                    <p className="font-semibold text-gray-600 dark:text-gray-300">Nenhum ficheiro de backup encontrado no Google Drive.</p>
                    <p className="text-xs">Os backups automáticos semanais, mensais ou de eliminados aparecerão aqui assim que forem executados.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {googleFiles.map((file) => {
                      const isDeletedBackup = file.name.startsWith('deleted_') || file.folder === 'eliminados';
                      return (
                        <div
                          key={file.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-400 dark:hover:border-primary-600 transition-all gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-lg shrink-0 ${
                              isDeletedBackup 
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' 
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            }`}>
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                                  {file.name}
                                </p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isDeletedBackup 
                                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' 
                                    : 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                }`}>
                                  {file.folder}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                                <span>Criado: {new Date(file.createdTime).toLocaleString('pt-PT')}</span>
                                {file.size > 0 && <span>Tamanho: {(file.size / 1024).toFixed(1)} KB</span>}
                              </p>
                            </div>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            disabled={loadingFileContent}
                            onClick={() => handleOpenGoogleBackup(file)}
                            className="text-xs font-semibold shrink-0 flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Consultar Dados</span>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: FICHEIRO JSON LOCAL */}
            {activeSourceTab === 'file' && (
              <div className="space-y-4 pt-2">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-gray-800/30 group"
                >
                  <div className="p-3 bg-primary-50 dark:bg-primary-950/50 text-primary-600 rounded-xl mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Carregar ficheiro de backup (.json)
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Clique aqui ou selecione um ficheiro de backup local (incluindo backups de registos eliminados) para inspecionar em modo de leitura.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" className="mt-4 text-xs font-semibold">
                    Escolher Ficheiro
                  </Button>
                </div>
              </div>
            )}

            {/* TAB: SNAPSHOT ATUAL */}
            {activeSourceTab === 'system' && (
              <div className="space-y-4 pt-2">
                <div className="p-5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3">
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary-600" />
                    <span>Visualizar Snapshot do Estado Atual</span>
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Gera uma fotografia em tempo real das despesas e definições atuais da conta para inspeção e auditoria, com todas as ferramentas de pesquisa e análise desta secção.
                  </p>
                  <Button
                    type="button"
                    onClick={handleLoadSystemSnapshot}
                    disabled={loadingFileContent}
                    className="text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{loadingFileContent ? 'A gerar snapshot...' : 'Consultar Snapshot Atual'}</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CASO 2: BACKUP CARREGADO - VISUALIZAÇÃO COMPLETA EM LEITURA */}
      {selectedBackup && (
        <div className="space-y-4 animate-in fade-in duration-150">
          
          {/* Barra Superior de Controlo da Visualização */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedBackup(null)}
                className="shrink-0 text-xs font-semibold flex items-center gap-1"
                title="Voltar à seleção de backups"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Mudar de Backup</span>
              </Button>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                  {backupTitle}
                </h3>
                <p className="text-[11px] text-gray-500 truncate">
                  {selectedBackup.exported_at ? `Exportado em: ${new Date(selectedBackup.exported_at).toLocaleString('pt-PT')}` : 'Sem data de exportação'} 
                  {selectedBackup.user_id && ` • Utilizador ID: ${selectedBackup.user_id}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadBackupJSON}
                className="text-xs font-semibold flex items-center gap-1.5"
                title="Descarregar ficheiro JSON deste backup"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descarregar JSON</span>
              </Button>
            </div>
          </div>

          {/* Destaque especial se for backup de limpeza / eliminados */}
          {selectedBackup.type === 'deleted_expenses_cleanup' && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <span className="text-base">🚨</span>
              <div className="flex-1">
                <strong>Cópia de Segurança de Registos Eliminados:</strong> Estes dados foram salvaguardados automaticamente antes da limpeza de {selectedBackup.cleanup_years || ''} anos.
                {selectedBackup.start_date && selectedBackup.end_date && (
                  <span> Período abrangido: <strong>{selectedBackup.start_date}</strong> a <strong>{selectedBackup.end_date}</strong>.</span>
                )}
              </div>
            </div>
          )}

          {/* Cartões com Totais e Métricas do Backup */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Total de Registos
              </span>
              <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-gray-100">
                {stats.count}
              </p>
              <p className="text-[11px] text-gray-500">
                {filteredExpenses.length !== stats.count ? `(${filteredExpenses.length} filtrados)` : 'Todas as despesas'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Valor Total Acumulado
              </span>
              <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                {formatMoney(stats.totalCents)}
              </p>
              <p className="text-[11px] text-gray-500">
                Média: {stats.count > 0 ? formatMoney(Math.round(stats.totalCents / stats.count)) : '€0.00'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Pagas vs Não Pagas
              </span>
              <p className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200">
                {formatMoney(stats.paidCents)}
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                Não pagas: {formatMoney(stats.unpaidCents)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Período das Despesas
              </span>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                {stats.oldestDate ? formatDate(stats.oldestDate) : 'N/A'}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                até {stats.newestDate ? formatDate(stats.newestDate) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Secção Expansível de Definições Contidas no Backup */}
          {selectedBackup.settings && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary-600" />
                  <span>Definições Arquivadas Neste Backup</span>
                </div>
                {showSettings ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showSettings && (
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-gray-700 dark:text-gray-300">
                  <div><strong>Tolerância de Variação:</strong> {selectedBackup.settings.tolerance ?? 2}%</div>
                  <div><strong>Lembrete Débito:</strong> {selectedBackup.settings.debit_notifications_enabled ? 'Ativo' : 'Inativo'} ({selectedBackup.settings.debit_reminder_days || 1} dias antes)</div>
                  <div><strong>Lembrete Valores Variáveis:</strong> {selectedBackup.settings.variable_reminder_enabled ? 'Ativo' : 'Inativo'} (dia {selectedBackup.settings.variable_reminder_day || 21})</div>
                  <div><strong>Notificações Globais:</strong> {selectedBackup.settings.notifications_enabled ? 'Ativas' : 'Inativas'}</div>
                  <div><strong>Backup Google Drive:</strong> {selectedBackup.settings.drive_backup_enabled ? 'Ativo' : 'Inativo'}</div>
                  <div><strong>Limpeza Automática:</strong> {selectedBackup.settings.auto_cleanup_years ? `${selectedBackup.settings.auto_cleanup_years} anos` : 'Desativada'}</div>
                </div>
              )}
            </div>
          )}

          {/* Barra de Filtros e Pesquisa */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Pesquisar por descrição..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Filtro Mês */}
              {availableMonths.length > 0 && (
                <select
                  value={filterMonth}
                  onChange={(e) => {
                    setFilterMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium"
                >
                  <option value="all">Todos os Meses</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}

              {/* Filtro Pago */}
              <select
                value={filterPaid}
                onChange={(e) => {
                  setFilterPaid(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="h-9 px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium"
              >
                <option value="all">Todos os Estados</option>
                <option value="paid">Apenas Pagas</option>
                <option value="unpaid">Apenas Não Pagas</option>
              </select>

              {/* Filtro Recorrência */}
              <select
                value={filterRecurring}
                onChange={(e) => {
                  setFilterRecurring(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="h-9 px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium"
              >
                <option value="all">Recorrentes e Pontuais</option>
                <option value="recurring">Recorrentes</option>
                <option value="single">Pontuais</option>
              </select>

              {/* Ordenação */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium"
              >
                <option value="date_desc">Data (Mais recente)</option>
                <option value="date_asc">Data (Mais antiga)</option>
                <option value="amount_desc">Valor (Maior)</option>
                <option value="amount_asc">Valor (Menor)</option>
                <option value="description">Descrição (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Tabela de Despesas Consultadas */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3.5">Data de Débito</th>
                    <th className="py-3 px-3.5">Descrição</th>
                    <th className="py-3 px-3.5 text-right">Valor</th>
                    <th className="py-3 px-3.5 text-center">Estado</th>
                    <th className="py-3 px-3.5 text-center">Tipo</th>
                    <th className="py-3 px-3.5 text-center">Fixa/Var</th>
                    {isPrivateAdmin && <th className="py-3 px-3.5 text-center">Privada</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={isPrivateAdmin ? 7 : 6} className="py-10 text-center text-gray-400">
                        Nenhuma despesa encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((exp, idx) => {
                      const amountCents = exp.amount_cents ?? Math.round((exp.amount || 0) * 100);
                      const isPaid = exp.paid === 1 || exp.paid === true;
                      const isRecurring = exp.recurring === 1 || exp.recurring === true;
                      const isFixed = exp.fixed_amount === 1 || exp.fixed_amount === true;

                      return (
                        <tr 
                          key={exp.id || idx}
                          className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          <td className="py-2.5 px-3.5 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {exp.debit_date ? formatDate(exp.debit_date) : 'Sem data'}
                          </td>
                          <td className="py-2.5 px-3.5 font-semibold text-gray-900 dark:text-gray-100">
                            {exp.description}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-black text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {formatMoney(amountCents)}
                          </td>
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPaid 
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}>
                              {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              <span>{isPaid ? 'Paga' : 'Pendente'}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                              {isRecurring ? `Recorrente (${exp.recurrence_months || 1}m)` : 'Pontual'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                              isFixed 
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' 
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                            }`}>
                              {isFixed ? 'Fixa' : 'Variável'}
                            </span>
                          </td>
                          {isPrivateAdmin && (
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              {exp.is_private === 1 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full">
                                  <Lock className="w-3 h-3" />
                                  <span>Sim</span>
                                </span>
                              ) : (
                                <span className="text-gray-400 text-[10px]">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                <span>A mostrar {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, filteredExpenses.length)} de {filteredExpenses.length} registos</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="h-7 text-xs"
                  >
                    Anterior
                  </Button>
                  <span className="px-2 font-semibold text-gray-700 dark:text-gray-300">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="h-7 text-xs"
                  >
                    Seguinte
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
