'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, ArrowLeft, Loader2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';

export default function NewAppPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [productIds, setProductIds] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Helper to slugify text dynamically
  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/\s+/g, '-') // replace spaces with -
      .replace(/[^\w\-]+/g, '') // remove non-word chars
      .replace(/\-\-+/g, '-') // replace multiple - with single -
      .replace(/^-+/, '') // trim - from start
      .replace(/-+$/, ''); // trim - from end
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    setSlug(slugify(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) {
      setError('Nome e Slug são campos obrigatórios.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Check if slug is unique
      const { data: existingApp } = await supabase
        .from('apps')
        .select('id')
        .eq('slug', slug.trim())
        .maybeSingle();

      if (existingApp) {
        throw new Error('Já existe um aplicativo com este slug. Por favor use outro slug.');
      }

      // 2. Insert App
      const { data: newApp, error: insertError } = await supabase
        .from('apps')
        .insert({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          product_ids: productIds.trim() || null,
          status,
          logo_url: logoUrl.trim() || null,
          cover_url: coverUrl.trim() || null,
        })
        .select()
        .single();

      if (insertError || !newApp) {
        throw new Error(insertError?.message || 'Falha ao criar aplicativo.');
      }

      // 3. Insert App Settings
      const { error: settingsError } = await supabase
        .from('app_settings')
        .upsert({
          app_id: newApp.id,
          primary_color: '#1E6BFF',
          secondary_color: '#0B2A4A',
          accent_color: '#4DA3FF',
          background_color: '#071A2F',
          text_color: '#F5F8FF',
        }, { onConflict: 'app_id' });

      if (settingsError) {
        // Fallback cleanup if settings fail
        await supabase.from('apps').delete().eq('id', newApp.id);
        throw new Error('Falha ao inicializar paleta de cores: ' + settingsError.message);
      }

      // 4. Insert PWA Settings
      const { error: pwaError } = await supabase
        .from('pwa_settings')
        .upsert({
          app_id: newApp.id,
          short_name: name.trim().slice(0, 12),
          theme_color: '#1E6BFF',
          background_color: '#071A2F',
          display: 'standalone',
          orientation: 'portrait',
        }, { onConflict: 'app_id' });

      if (pwaError) {
        // Cleanup settings and app
        await supabase.from('app_settings').delete().eq('app_id', newApp.id);
        await supabase.from('apps').delete().eq('id', newApp.id);
        throw new Error('Falha ao inicializar configurações PWA: ' + pwaError.message);
      }

      // Track admin action
      await supabase.from('audit_logs').insert({
        action: 'app_created',
        details: { app_id: newApp.id, app_name: newApp.name, slug: newApp.slug },
      });

      router.push('/admin/apps');
      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao criar aplicativo.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      
      {/* Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Link 
          href="/admin/apps"
          className="flex items-center gap-1.5 text-xs font-semibold text-text-gray hover:text-text-white transition-all bg-card-bg/60 border border-border-color/50 px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-3 bg-accent-blue/15 text-light-blue rounded-xl">
          <Layers className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-white">Criar Novo Aplicativo</h2>
          <p className="text-xs text-text-gray mt-0.5">Cadastre um novo treinamento ou produto web app.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-4 rounded-xl">
          <p className="font-semibold">Erro ao salvar</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Creation form */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 sm:p-8 rounded-2xl space-y-6">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
              Nome do Aplicativo *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Treinamento Avançado"
              value={name}
              onChange={handleNameChange}
              className="w-full bg-primary-bg border border-border-color text-text-white placeholder-text-gray/50 px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
              Slug da URL *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-text-gray/50">
                /app/
              </span>
              <input
                type="text"
                required
                placeholder="ex-treinamento"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="w-full bg-primary-bg border border-border-color text-text-white placeholder-text-gray/50 pl-14 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
            Descrição do App
          </label>
          <textarea
            rows={3}
            placeholder="Forneça uma breve descrição sobre o conteúdo deste aplicativo..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-primary-bg border border-border-color text-text-white placeholder-text-gray/50 px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
              Ids de Venda das Plataformas (Kiwify, Hotmart, etc)
            </label>
            <input
              type="text"
              placeholder="Ex: 213098, k_98230982 (separados por vírgula)"
              value={productIds}
              onChange={(e) => setProductIds(e.target.value)}
              className="w-full bg-primary-bg border border-border-color text-text-white placeholder-text-gray/50 px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
            />
            <p className="text-[10px] text-text-gray mt-1.5 leading-relaxed">
              O webhook usará esses IDs para identificar a qual aplicativo o cliente deve ter acesso quando realizar uma compra.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
              Status Inicial
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
              className="w-full bg-primary-bg border border-border-color text-text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
            >
              <option value="draft">Rascunho (Privado para o Admin)</option>
              <option value="published">Publicado (Acessível por alunos autorizados)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-border-color/30 pt-6">
          <div>
            <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
              Link do Logo (Opcional)
            </label>
            <input
              type="url"
              placeholder="https://sua-midia.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full bg-primary-bg border border-border-color text-text-white placeholder-text-gray/50 px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
              Link da Capa / Banner (Opcional)
            </label>
            <input
              type="url"
              placeholder="https://sua-midia.com/banner.jpg"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              className="w-full bg-primary-bg border border-border-color text-text-white placeholder-text-gray/50 px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border-color/30 pt-6">
          <Link
            href="/admin/apps"
            className="bg-card-bg hover:bg-border-color border border-border-color/80 text-text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="bg-accent-blue hover:bg-light-blue disabled:bg-accent-blue/50 text-text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 shadow-lg shadow-accent-blue/15"
          >
            {loading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                Criando App...
              </>
            ) : (
              <>
                <Save className="h-4.5 w-4.5" />
                Salvar Aplicativo
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}
