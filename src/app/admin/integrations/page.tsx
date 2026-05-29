'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Sliders, 
  Link as LinkIcon, 
  Check, 
  Copy, 
  ExternalLink, 
  Loader2, 
  ShieldAlert, 
  ToggleLeft, 
  ToggleRight,
  Info
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import type { WebhookPlatform } from '@/lib/env';

interface Integration {
  id?: string;
  platform: WebhookPlatform;
  api_key: string | null;
  webhook_secret: string | null;
  is_active: boolean;
}

const platformMeta = {
  kiwify: { name: 'Kiwify', logo: 'https://images.kiwify.com.br/logo.png', color: 'from-green-500 to-emerald-600', url: 'https://dashboard.kiwify.com.br' },
  hotmart: { name: 'Hotmart', logo: '', color: 'from-orange-500 to-red-600', url: 'https://hotmart.com' },
  eduzz: { name: 'Eduzz', logo: '', color: 'from-amber-400 to-yellow-600', url: 'https://orbita.eduzz.com' },
  monetizze: { name: 'Monetizze', logo: '', color: 'from-blue-500 to-cyan-600', url: 'https://monetizze.com.br' },
  cakto: { name: 'Cakto', logo: '', color: 'from-indigo-500 to-purple-600', url: 'https://cakto.com.br' },
  cartpanda: { name: 'Cartpanda', logo: '', color: 'from-slate-500 to-zinc-700', url: 'https://cartpanda.com' },
  ticto: { name: 'Ticto', logo: '', color: 'from-red-500 to-rose-600', url: 'https://ticto.com.br' },
};

export default function IntegrationsPage() {
  const supabase = createClient();
  const [integrations, setIntegrations] = useState<Record<string, Integration>>({});
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Modal / Form state
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [originUrl, setOriginUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(window.location.origin);
    }

    async function loadIntegrations() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('platform_integrations')
          .select('*');

        if (error) throw error;

        const mapped: Record<string, Integration> = {};
        data?.forEach((item) => {
          mapped[item.platform] = item;
        });

        // Ensure all platforms have a blank placeholder state in UI if not configured
        const allPlatforms: Array<Integration['platform']> = ['kiwify', 'hotmart', 'eduzz', 'monetizze', 'cakto', 'cartpanda', 'ticto'];
        allPlatforms.forEach((p) => {
          if (!mapped[p]) {
            mapped[p] = { platform: p, api_key: null, webhook_secret: null, is_active: false };
          }
        });

        setIntegrations(mapped);
      } catch (err) {
        console.error('Error fetching integrations:', err);
      } finally {
        setLoading(false);
      }
    }

    loadIntegrations();
  }, [supabase]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleEditClick = (platform: string) => {
    const integration = integrations[platform];
    setEditingPlatform(platform);
    setApiKey(integration.api_key || '');
    setWebhookSecret(integration.webhook_secret || '');
    setIsActive(integration.is_active);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlatform) return;
    setActionLoading(true);

    try {
      const integration = integrations[editingPlatform];
      const { data, error } = await supabase
        .from('platform_integrations')
        .upsert({
          id: integration.id, // Will insert if undefined, update if defined
          platform: editingPlatform as WebhookPlatform,
          api_key: apiKey.trim() || null,
          webhook_secret: webhookSecret.trim() || null,
          is_active: isActive,
        }, { onConflict: 'platform' })
        .select()
        .single();

      if (error) throw error;

      setIntegrations({
        ...integrations,
        [editingPlatform]: data,
      });

      // Log action
      await supabase.from('audit_logs').insert({
        action: 'integration_configured',
        details: { platform: editingPlatform, is_active: isActive },
      });

      setEditingPlatform(null);
    } catch (err: unknown) {
      alert('Erro ao salvar integração: ' + getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (platform: string) => {
    const integration = integrations[platform];
    const newStatus = !integration.is_active;

    try {
      const { data, error } = await supabase
        .from('platform_integrations')
        .upsert({
          id: integration.id,
          platform: platform as WebhookPlatform,
          is_active: newStatus,
        }, { onConflict: 'platform' })
        .select()
        .single();

      if (error) throw error;

      setIntegrations({
        ...integrations,
        [platform]: data,
      });

      await supabase.from('audit_logs').insert({
        action: newStatus ? 'integration_activated' : 'integration_deactivated',
        details: { platform },
      });
    } catch (err: unknown) {
      alert('Erro ao alterar status: ' + getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-gray text-sm">Carregando plataformas de integração...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-white">Integrações de Venda</h2>
        <p className="text-text-gray text-sm mt-1">Conecte checkouts para liberar acessos automaticamente após vendas aprovadas.</p>
      </div>

      {/* Warning Box */}
      <div className="bg-card-bg border border-border-color p-4.5 rounded-2xl flex gap-3 items-start text-xs text-text-gray">
        <Info className="h-5 w-5 text-light-blue shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-text-white">Como funcionam as integrações?</p>
          <p className="leading-relaxed">
            Configure o webhook na plataforma escolhida apontando para a <strong>URL de Webhook</strong> gerada em cada card. 
            Assim que a compra for aprovada, o acesso do aluno ao aplicativo correspondente será criado e liberado automaticamente.
          </p>
        </div>
      </div>

      {/* Grid of integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(platformMeta).map(([key, meta]) => {
          const integration = integrations[key];
          const isActive = integration?.is_active;
          const webhookUrl = `${originUrl}/api/webhooks/${key}`;
          
          return (
            <div 
              key={key} 
              className={`glass-panel rounded-2xl overflow-hidden flex flex-col justify-between border-t-4 hover:border-accent-blue/40 transition-all duration-300 ${
                isActive ? 'border-t-accent-blue' : 'border-t-border-color'
              }`}
            >
              <div className="p-6 space-y-5">
                {/* Platform info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-md font-bold text-text-white capitalize">{meta.name}</h3>
                    <p className="text-[10px] text-text-gray mt-0.5">Gateway de Pagamento</p>
                  </div>
                  
                  {/* Status Toggle */}
                  <button 
                    onClick={() => handleToggleActive(key)}
                    className="p-1 text-text-gray transition-colors"
                  >
                    {isActive ? (
                      <ToggleRight className="h-9 w-9 text-light-blue" />
                    ) : (
                      <ToggleLeft className="h-9 w-9 text-text-gray/50" />
                    )}
                  </button>
                </div>

                {/* Webhook URL Input Copy */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-text-gray uppercase tracking-wider">
                    URL de Webhook
                  </label>
                  <div className="flex items-center gap-1.5 bg-primary-bg/75 border border-border-color/60 rounded-xl p-2 font-mono text-[10px] text-text-white truncate">
                    <span className="truncate flex-1">{webhookUrl}</span>
                    <button 
                      onClick={() => copyToClipboard(webhookUrl, key)}
                      className="p-1 hover:bg-card-bg rounded text-text-gray hover:text-white transition"
                      title="Copiar URL"
                    >
                      {copiedKey === key ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Configuration stats */}
                <div className="text-[10px] text-text-gray/80 space-y-1 pt-1.5 border-t border-border-color/20">
                  <div className="flex justify-between">
                    <span>API Key:</span>
                    <span className="font-semibold text-text-white">{integration?.api_key ? '✓ Configurado' : 'Não configurado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Webhook Secret:</span>
                    <span className="font-semibold text-text-white">{integration?.webhook_secret ? '✓ Configurado' : 'Não configurado'}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="bg-secondary-bg/50 border-t border-border-color/60 px-6 py-4 flex items-center justify-between">
                <button
                  onClick={() => handleEditClick(key)}
                  className="bg-card-bg hover:bg-primary-bg border border-border-color/50 text-text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
                >
                  Configurar Chaves
                </button>
                <Link 
                  href={meta.url}
                  target="_blank"
                  className="text-xs text-light-blue hover:text-accent-blue flex items-center gap-1 font-semibold"
                >
                  Ir para Painel
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Integration Modal */}
      {editingPlatform && (
        <div className="fixed inset-0 bg-primary-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-secondary-bg border border-border-color max-w-md w-full p-6 rounded-2xl shadow-2xl space-y-5">
            <h3 className="text-sm font-bold text-text-white capitalize">
              Configurar Integração — {editingPlatform}
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-text-gray mb-1.5">API Key (Token Privado)</label>
                <input
                  type="text"
                  placeholder="Insira a API Key se fornecida pelo checkout"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-gray mb-1.5">Segredo de Validação do Webhook (Token de Validação)</label>
                <input
                  type="text"
                  placeholder="Token ou assinatura secreta fornecida no webhook"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue font-mono"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-text-gray cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 bg-primary-bg border border-border-color rounded focus:ring-accent-blue"
                  />
                  <span>Ativar esta integração no sistema</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border-color/30">
              <button
                type="button"
                onClick={() => setEditingPlatform(null)}
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
                Salvar Chaves
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
