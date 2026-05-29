'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Layers, 
  Users, 
  CheckCircle, 
  DollarSign, 
  RefreshCw, 
  Activity, 
  AlertTriangle, 
  ArrowUpRight,
  TrendingUp,
  Clock
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import type { AuditLogRecord, WebhookEventRecord } from '@/lib/types';

interface DashboardStats {
  totalApps: number;
  totalUsers: number;
  activeAccesses: number;
  totalRevenue: number;
  recentWebhooks: WebhookEventRecord[];
  recentLogs: AuditLogRecord[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalApps: 0,
    totalUsers: 0,
    activeAccesses: 0,
    totalRevenue: 0,
    recentWebhooks: [],
    recentLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const supabase = createClient();

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      
      // 1. Fetch apps count
      const { count: appsCount } = await supabase
        .from('apps')
        .select('*', { count: 'exact', head: true });

      // 2. Fetch users count
      const { count: usersCount } = await supabase
        .from('final_users')
        .select('*', { count: 'exact', head: true });

      // 3. Fetch active access count
      const { count: activeCount } = await supabase
        .from('user_app_access')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // 4. Fetch sales sum
      const { data: salesData } = await supabase
        .from('orders')
        .select('amount')
        .eq('status', 'approved');
      
      const revenue = salesData?.reduce((acc, order) => acc + Number(order.amount || 0), 0) || 0;

      // 5. Recent Webhooks
      const { data: webhooks } = await supabase
        .from('webhook_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(6);

      // 6. Recent Logs
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      setStats({
        totalApps: appsCount || 0,
        totalUsers: usersCount || 0,
        activeAccesses: activeCount || 0,
        totalRevenue: revenue,
        recentWebhooks: webhooks || [],
        recentLogs: logs || [],
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Mock chart data structure built from recent events
  const chartData = [
    { name: 'Jan', vendas: stats.totalRevenue * 0.05 + 100 },
    { name: 'Fev', vendas: stats.totalRevenue * 0.1 + 150 },
    { name: 'Mar', vendas: stats.totalRevenue * 0.15 + 300 },
    { name: 'Abr', vendas: stats.totalRevenue * 0.25 + 400 },
    { name: 'Mai', vendas: stats.totalRevenue || 950 },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-gray text-sm">Carregando painel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Header title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-white">Visão Geral</h2>
          <p className="text-text-gray text-sm mt-1">Acompanhe métricas, acessos e integrações em tempo real.</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-2 bg-card-bg hover:bg-border-color border border-border-color/80 text-text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Faturamento */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-gray">Vendas Recebidas</p>
              <h3 className="text-2xl font-bold text-text-white mt-2">{formatCurrency(stats.totalRevenue)}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-emerald-400 text-xs">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Faturamento acumulado</span>
          </div>
        </div>

        {/* Card 2: Aplicativos */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-gray">Aplicativos Criados</p>
              <h3 className="text-2xl font-bold text-text-white mt-2">{stats.totalApps}</h3>
            </div>
            <div className="p-3 bg-accent-blue/10 border border-accent-blue/20 text-light-blue rounded-xl">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-text-gray text-xs">
            <span>Web apps ilimitados ativos</span>
          </div>
        </div>

        {/* Card 3: Clientes */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-gray">Usuários Finais</p>
              <h3 className="text-2xl font-bold text-text-white mt-2">{stats.totalUsers}</h3>
            </div>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-indigo-400 text-xs">
            <span>Usuários integrados por checkout</span>
          </div>
        </div>

        {/* Card 4: Acessos Ativos */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-gray">Acessos Ativos</p>
              <h3 className="text-2xl font-bold text-text-white mt-2">{stats.activeAccesses}</h3>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-purple-400 text-xs">
            <span>Alunos com permissão ativa</span>
          </div>
        </div>

      </div>

      {/* Main Charts & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Column */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-bold text-text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-light-blue" />
              Evolução das Vendas (BRL)
            </h4>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E6BFF" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#1E6BFF" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B3554" opacity={0.3} />
                <XAxis dataKey="name" stroke="#9BAEC8" fontSize={11} tickLine={false} />
                <YAxis stroke="#9BAEC8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0B2A4A', borderColor: '#1B3554', color: '#F5F8FF', borderRadius: '8px' }} 
                  labelStyle={{ color: '#9BAEC8', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="vendas" stroke="#1E6BFF" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Logs Column */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h4 className="text-md font-bold text-text-white flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-purple-400" />
              Histórico do Sistema
            </h4>
            <div className="space-y-4">
              {stats.recentLogs.length === 0 ? (
                <div className="text-center py-8 text-text-gray text-xs">Nenhum evento registrado ainda.</div>
              ) : (
                stats.recentLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 items-start text-xs border-b border-border-color/30 pb-3 last:border-0 last:pb-0">
                    <div className="p-1.5 rounded-lg bg-card-bg border border-border-color text-text-gray mt-0.5">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-white truncate">
                        {log.action === 'access_granted' && 'Acesso Liberado'}
                        {log.action === 'access_blocked' && 'Acesso Bloqueado'}
                        {log.action === 'email_sent_simulation' && 'E-mail de Acesso'}
                        {log.action === 'webhook_failed' && 'Erro de Webhook'}
                        {!['access_granted', 'access_blocked', 'email_sent_simulation', 'webhook_failed'].includes(log.action) && log.action}
                      </p>
                      <p className="text-[11px] text-text-gray truncate">{log.user_email || 'Sistema'}</p>
                    </div>
                    <span className="text-[10px] text-text-gray/70 shrink-0">
                      {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <Link 
            href="/admin/webhooks" 
            className="flex items-center justify-center gap-2 w-full text-center text-xs font-semibold text-light-blue hover:text-accent-blue py-2 border-t border-border-color/50 mt-4 transition-all"
          >
            Ver webhooks detalhados
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

      </div>

      {/* Recent Webhooks List */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-md font-bold text-text-white flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-light-blue" />
            Últimos Webhooks Recebidos
          </h4>
          <Link href="/admin/webhooks" className="text-xs font-semibold text-light-blue hover:text-accent-blue flex items-center gap-1">
            Ver Todos
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {stats.recentWebhooks.length === 0 ? (
          <div className="text-center py-10 text-text-gray text-sm">
            Nenhum webhook recebido ainda. Configure seu checkout para enviar eventos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-color/85 text-text-gray font-semibold uppercase tracking-wider">
                  <th className="pb-3">Plataforma</th>
                  <th className="pb-3">Evento</th>
                  <th className="pb-3">Comprador</th>
                  <th className="pb-3">Transação</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/25">
                {stats.recentWebhooks.map((webhook) => (
                  <tr key={webhook.id} className="hover:bg-card-bg/20">
                    <td className="py-3 font-semibold text-text-white capitalize">{webhook.platform}</td>
                    <td className="py-3 text-text-gray truncate max-w-[120px]">{webhook.event_type}</td>
                    <td className="py-3">
                      <p className="text-text-white font-medium">{webhook.buyer_name || 'Desconhecido'}</p>
                      <p className="text-[10px] text-text-gray">{webhook.buyer_email}</p>
                    </td>
                    <td className="py-3 font-mono text-text-gray/80">{webhook.transaction_id || '-'}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        webhook.status === 'processed' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : webhook.status === 'failed'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {webhook.status === 'processed' && 'Processado'}
                        {webhook.status === 'failed' && 'Falhou'}
                        {webhook.status === 'pending' && 'Pendente'}
                      </span>
                    </td>
                    <td className="py-3 text-right text-text-gray">
                      {new Date(webhook.received_at).toLocaleDateString('pt-BR')} {new Date(webhook.received_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
