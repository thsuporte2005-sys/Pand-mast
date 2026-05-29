'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Users, 
  Plus, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Loader2,
  Mail,
  User,
  PlusCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';

interface AccessItem {
  id: string;
  user_id: string;
  app_id: string;
  status: 'active' | 'blocked' | 'expired';
  granted_at: string;
  platform: string | null;
  transaction_id: string | null;
  // Merged user details
  name?: string | null;
  email?: string;
}

export default function AppUsersPage() {
  const { id: appId } = useParams() as { id: string };
  const supabase = createClient();

  const [appName, setAppName] = useState('');
  const [accesses, setAccesses] = useState<AccessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal / Action states
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantName, setGrantName] = useState('');
  const [grantEmail, setGrantEmail] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsersAndAccess = async () => {
    try {
      setLoading(true);

      // Load App Name
      const { data: appData } = await supabase.from('apps').select('name').eq('id', appId).single();
      if (appData) setAppName(appData.name);

      // 1. Fetch access records
      const { data: accessData, error: accessErr } = await supabase
        .from('user_app_access')
        .select('*')
        .eq('app_id', appId);

      if (accessErr) throw accessErr;

      const records = accessData || [];

      if (records.length === 0) {
        setAccesses([]);
        return;
      }

      // 2. Fetch final users profiles to merge details
      const userIds = records.map(r => r.user_id);
      const { data: userData, error: userErr } = await supabase
        .from('final_users')
        .select('*')
        .in('id', userIds);

      if (userErr) throw userErr;

      const userMap = new Map(userData?.map(u => [u.id, u]) || []);

      // 3. Merge records
      const merged: AccessItem[] = records.map(record => {
        const profile = userMap.get(record.user_id);
        return {
          ...record,
          name: profile?.name || 'Sem nome',
          email: profile?.email || 'Sem e-mail',
        };
      });

      setAccesses(merged);
    } catch (err) {
      console.error('Error fetching app users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndAccess();
  }, [appId]);

  // Handle manual grant submission
  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantEmail) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant',
          email: grantEmail,
          name: grantName,
          appId: appId
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao conceder acesso');

      // Refresh list
      await fetchUsersAndAccess();
      
      // Reset & close
      setGrantName('');
      setGrantEmail('');
      setShowGrantModal(false);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Change access status (block/unblock)
  const handleToggleBlock = async (userId: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'block' : 'unblock';
    const confirmMsg = action === 'block' 
      ? 'Tem certeza de que deseja BLOQUEAR o acesso deste aluno ao aplicativo?' 
      : 'Deseja realmente DESBLOQUEAR o acesso deste aluno?';

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, appId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao alterar status de acesso');
      }

      // Update state locally
      setAccesses(accesses.map(a => 
        a.user_id === userId 
          ? { ...a, status: action === 'block' ? 'blocked' : 'active' } 
          : a
      ));
    } catch (err: unknown) {
      alert('Erro ao alterar status: ' + getErrorMessage(err));
    }
  };

  // Revoke Access (delete access row)
  const handleRevoke = async (userId: string) => {
    if (!confirm('Deseja realmente REMOVER permanentemente o registro de acesso deste aluno?')) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', userId, appId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao revogar acesso');
      }

      // Remove from state
      setAccesses(accesses.filter(a => a.user_id !== userId));
    } catch (err: unknown) {
      alert('Erro ao revogar acesso: ' + getErrorMessage(err));
    }
  };

  // Search and Filter records
  const filteredAccesses = accesses.filter(item => {
    const matchesSearch = 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.transaction_id?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-gray text-sm">Carregando acessos de alunos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Link 
          href="/admin/apps"
          className="flex items-center gap-1.5 text-xs font-semibold text-text-gray hover:text-text-white transition-all bg-card-bg/60 border border-border-color/50 px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para Aplicativos
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-white">Alunos Vinculados — {appName}</h2>
            <p className="text-xs text-text-gray mt-0.5">Veja quem possui acesso a este app, altere permissões ou adicione manualmente.</p>
          </div>
        </div>

        <button
          onClick={() => setShowGrantModal(true)}
          className="self-start sm:self-auto flex items-center gap-2 bg-accent-blue hover:bg-light-blue text-text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-accent-blue/15"
        >
          <Plus className="h-4.5 w-4.5" />
          Liberar Acesso Manual
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-gray/70" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou código de transação..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-primary-bg border border-border-color/80 text-text-white placeholder-text-gray/50 pl-11 pr-4 py-2 rounded-xl focus:outline-none focus:border-accent-blue text-xs"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-primary-bg border border-border-color/80 text-text-white px-3 py-2 rounded-xl focus:outline-none focus:border-accent-blue text-xs"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Acesso Ativo</option>
            <option value="blocked">Acesso Bloqueado</option>
            <option value="expired">Acesso Expirado</option>
          </select>
        </div>
      </div>

      {/* Table grid */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {filteredAccesses.length === 0 ? (
          <div className="text-center py-14 text-text-gray text-xs">
            Nenhum aluno encontrado para os critérios aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-color/80 bg-secondary-bg/25 text-text-gray font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4.5">Nome / Aluno</th>
                  <th className="px-6 py-4.5">Origem da Compra</th>
                  <th className="px-6 py-4.5">ID da Transação</th>
                  <th className="px-6 py-4.5">Liberado em</th>
                  <th className="px-6 py-4.5">Status</th>
                  <th className="px-6 py-4.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {filteredAccesses.map((item) => (
                  <tr key={item.id} className="hover:bg-card-bg/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-text-white">{item.name}</p>
                      <p className="text-[10px] text-text-gray font-mono">{item.email}</p>
                    </td>
                    <td className="px-6 py-4 capitalize font-semibold text-text-white">
                      {item.platform === 'manual' ? (
                        <span className="text-[10px] bg-card-bg border border-border-color px-2 py-0.5 rounded text-text-gray font-mono">Manual</span>
                      ) : (
                        item.platform
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-text-gray/80">{item.transaction_id || '-'}</td>
                    <td className="px-6 py-4 text-text-gray">
                      {new Date(item.granted_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {item.status === 'active' ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />
                            Bloqueado
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleToggleBlock(item.user_id, item.status)}
                        className={`p-1.5 rounded-lg border transition-all inline-flex items-center justify-center ${
                          item.status === 'active'
                            ? 'text-amber-400 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'
                            : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'
                        }`}
                        title={item.status === 'active' ? 'Bloquear Acesso' : 'Desbloquear Acesso'}
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRevoke(item.user_id)}
                        className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all inline-flex items-center justify-center"
                        title="Revogar / Deletar Acesso"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grant Manual Access Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-primary-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleGrantAccess} className="bg-secondary-bg border border-border-color max-w-md w-full p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex gap-3 items-center border-b border-border-color/30 pb-3">
              <PlusCircle className="h-5 w-5 text-light-blue" />
              <h3 className="text-sm font-bold text-text-white">Liberar Acesso Manual</h3>
            </div>

            {actionError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] p-3 rounded-lg flex gap-1.5 items-start">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-text-gray mb-1.5">Nome do Aluno</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-gray/50" />
                  <input
                    type="text"
                    placeholder="Nome Completo"
                    value={grantName}
                    onChange={(e) => setGrantName(e.target.value)}
                    className="w-full bg-primary-bg border border-border-color text-text-white pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-gray mb-1.5">E-mail do Aluno *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-gray/50" />
                  <input
                    type="email"
                    required
                    placeholder="aluno@email.com"
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                    className="w-full bg-primary-bg border border-border-color text-text-white pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>

              <div className="bg-card-bg/40 border border-border-color/40 rounded-xl p-3 text-[10px] text-text-gray leading-relaxed flex gap-2">
                <Clock className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  Se o aluno já tiver cadastro no Pand mast, o acesso será vinculado imediatamente. Se for um novo usuário, uma conta será criada em segundo plano e uma senha temporária será registrada no histórico de logs do sistema.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border-color/30">
              <button
                type="button"
                onClick={() => { setShowGrantModal(false); setActionError(null); }}
                className="bg-card-bg hover:bg-border-color px-4 py-2 rounded-xl text-xs font-semibold text-text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="bg-accent-blue hover:bg-light-blue px-4 py-2 rounded-xl text-xs font-semibold text-text-white flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Liberar Acesso
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
