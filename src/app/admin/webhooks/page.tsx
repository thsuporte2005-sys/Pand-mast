'use client';

import React, { useState, useEffect } from 'react';
import { 
  Webhook, 
  Search, 
  RefreshCw, 
  Terminal, 
  AlertTriangle, 
  Code,
  Calendar,
  Play,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import type { JsonValue } from '@/lib/types';

interface WebhookEvent {
  id: string;
  platform: string;
  event_type: string;
  buyer_name: string | null;
  buyer_email: string | null;
  product_id: string | null;
  product_name: string | null;
  transaction_id: string | null;
  order_status: string;
  status: 'processed' | 'failed' | 'pending';
  error_message: string | null;
  raw_payload: JsonValue;
  received_at: string;
}

export default function WebhooksDebuggerPage() {
  const supabase = createClient();
  
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  
  // Selected event detail view
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [reprocessSuccess, setReprocessSuccess] = useState(false);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const query = supabase
        .from('webhook_events')
        .select('*')
        .order('received_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching webhooks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const handleReprocess = async (eventId: string) => {
    setReprocessingId(eventId);
    setReprocessSuccess(false);

    try {
      const res = await fetch('/api/admin/webhooks/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao reprocessar webhook');
      }

      setReprocessSuccess(true);
      await fetchWebhooks(); // Refresh list to see updated status
      
      // Update selected event detail view
      const updated = events.find(e => e.id === eventId);
      if (updated) {
        setSelectedEvent({ ...updated, status: 'processed', error_message: null });
      }
    } catch (err: unknown) {
      alert('Erro ao reprocessar: ' + getErrorMessage(err));
    } finally {
      setReprocessingId(null);
    }
  };

  // Filter list
  const filteredEvents = events.filter(e => {
    const matchesSearch = 
      (e.buyer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.buyer_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.transaction_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.product_id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchesPlatform = platformFilter === 'all' || e.platform === platformFilter;

    return matchesSearch && matchesStatus && matchesPlatform;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-gray text-sm">Carregando logs de webhooks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
            <Webhook className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-white">Depurador de Webhooks</h2>
            <p className="text-xs text-text-gray mt-0.5">Analise payloads recebidos, inspecione erros e reprocesse requisições pendentes ou falhas.</p>
          </div>
        </div>

        <button
          onClick={fetchWebhooks}
          className="self-start sm:self-auto flex items-center gap-2 bg-card-bg hover:bg-border-color border border-border-color/80 text-text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition"
        >
          <RefreshCw className="h-4.5 w-4.5" />
          Atualizar Histórico
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-gray/50" />
          <input
            type="text"
            placeholder="Buscar por e-mail, transição ou produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-primary-bg border border-border-color text-text-white placeholder-text-gray/50 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-xs"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-primary-bg border border-border-color text-text-white px-3 py-2.5 rounded-xl focus:outline-none text-xs"
          >
            <option value="all">Todos os Status</option>
            <option value="processed">Processados</option>
            <option value="failed">Com Erro / Falhos</option>
            <option value="pending">Pendentes</option>
          </select>
        </div>

        <div>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="w-full bg-primary-bg border border-border-color text-text-white px-3 py-2.5 rounded-xl focus:outline-none text-xs"
          >
            <option value="all">Todas as Plataformas</option>
            <option value="kiwify">Kiwify</option>
            <option value="hotmart">Hotmart</option>
            <option value="eduzz">Eduzz</option>
            <option value="monetizze">Monetizze</option>
            <option value="cakto">Cakto</option>
            <option value="cartpanda">Cartpanda</option>
            <option value="ticto">Ticto</option>
          </select>
        </div>
      </div>

      {/* Main split grid (List & details) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Webhooks list (Left) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-color/40 bg-secondary-bg/25">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-gray">Histórico de Eventos ({filteredEvents.length})</h3>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-16 text-text-gray text-xs">
              Nenhum evento registrado correspondente aos filtros.
            </div>
          ) : (
            <div className="divide-y divide-border-color/30 max-h-[60vh] overflow-y-auto">
              {filteredEvents.map((e) => {
                const isSelected = selectedEvent?.id === e.id;
                return (
                  <div
                    key={e.id}
                    onClick={() => { setSelectedEvent(e); setReprocessSuccess(false); }}
                    className={`flex items-center justify-between p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-accent-blue/10 border-l-4 border-accent-blue' 
                        : 'hover:bg-card-bg/20'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-text-white capitalize">{e.platform}</span>
                        <span className="text-[10px] text-text-gray font-mono truncate max-w-[120px]">{e.event_type}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-[10px] text-text-gray">
                        <span className="truncate">{e.buyer_email || 'Sem email'}</span>
                        <span>•</span>
                        <span className="font-mono">{e.transaction_id || 'Sem TX'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        e.status === 'processed'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : e.status === 'failed'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {e.status === 'processed' && 'Sucesso'}
                        {e.status === 'failed' && 'Erro'}
                        {e.status === 'pending' && 'Pendente'}
                      </span>

                      <ChevronRight className="h-4 w-4 text-text-gray/50" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Event Payload Detail (Right) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-5 rounded-2xl space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-gray border-b border-border-color/30 pb-3 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-purple-400" />
              Inspetor de Webhook
            </h3>

            {!selectedEvent ? (
              <div className="text-center py-16 text-text-gray text-xs">
                Selecione um webhook na lista ao lado para ver o payload original e status de execução.
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                
                {/* Event header details */}
                <div className="bg-primary-bg/50 border border-border-color/40 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-text-gray font-mono">{selectedEvent.id}</span>
                    <span className="text-text-gray flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(selectedEvent.received_at).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[10px] pt-2 border-t border-border-color/25">
                    <div>
                      <p className="text-text-gray">Produto ID:</p>
                      <p className="font-semibold text-text-white font-mono">{selectedEvent.product_id || '-'}</p>
                    </div>
                    <div>
                      <p className="text-text-gray">Transação ID:</p>
                      <p className="font-semibold text-text-white font-mono">{selectedEvent.transaction_id || '-'}</p>
                    </div>
                  </div>

                  {selectedEvent.error_message && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] p-3 rounded-lg flex gap-1.5 mt-2.5">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                      <div>
                        <p className="font-bold">Detalhes do Erro:</p>
                        <p className="text-[10px] mt-0.5 leading-relaxed font-mono">{selectedEvent.error_message}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* JSON Code Viewer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-text-gray uppercase tracking-wider flex items-center gap-1">
                      <Code className="h-3.5 w-3.5" />
                      Payload do Checkout (JSON)
                    </span>
                  </div>
                  
                  <pre className="bg-primary-bg border border-border-color/80 text-light-blue p-3.5 rounded-xl overflow-x-auto text-[10px] max-h-64 font-mono leading-normal">
                    {JSON.stringify(selectedEvent.raw_payload, null, 2)}
                  </pre>
                </div>

                {/* Reprocess action box */}
                <div className="border-t border-border-color/30 pt-4 flex gap-2">
                  <button
                    onClick={() => handleReprocess(selectedEvent.id)}
                    disabled={reprocessingId === selectedEvent.id}
                    className="flex-1 bg-accent-blue hover:bg-light-blue disabled:bg-accent-blue/50 text-text-white py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    {reprocessingId === selectedEvent.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Reprocessar Payload
                      </>
                    )}
                  </button>
                </div>

                {reprocessSuccess && (
                  <div className="bg-emerald-500/15 text-emerald-400 p-2.5 rounded-lg border border-emerald-500/30 text-center font-semibold">
                    Reprocessado com sucesso!
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
