'use client';

import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Settings, 
  Palette, 
  Smartphone, 
  Save, 
  Loader2, 
  Check, 
  Layers,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppPreviewPhone } from '@/components/admin/app-preview-phone';
import { saveAdminAppConfiguration } from '@/lib/admin/app-configuration';
import { sanitizeStorageFileName, validatePublicImage } from '@/lib/app-experience';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage, logTechnicalError } from '@/lib/errors';
import { APP_ASSETS_BUCKET } from '@/lib/storage';

interface PreviewModule {
  id: string;
  name: string;
  cover_image_url?: string | null;
  release_type?: string | null;
  release_after_days?: number | null;
  is_scheduled_release?: boolean | null;
}

interface PreviewCarouselImage {
  id: string;
  image_url: string;
  alt_text?: string | null;
  is_active?: boolean;
}

export default function AppSettingsPage() {
  const { id: appId } = useParams() as { id: string };
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'pwa'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Tab 1: General Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [productIds, setProductIds] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPath, setLogoPath] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [previewModules, setPreviewModules] = useState<PreviewModule[]>([]);
  const [previewCarouselImages, setPreviewCarouselImages] = useState<PreviewCarouselImage[]>([]);
  const [carouselEnabled, setCarouselEnabled] = useState(false);
  const [supportEnabled, setSupportEnabled] = useState(false);
  const [supportIconUrl, setSupportIconUrl] = useState('');

  // Tab 2: Appearance Form State
  const [primaryColor, setPrimaryColor] = useState('#1E6BFF');
  const [secondaryColor, setSecondaryColor] = useState('#0B2A4A');
  const [accentColor, setAccentColor] = useState('#4DA3FF');
  const [backgroundColor, setBackgroundColor] = useState('#071A2F');
  const [textColor, setTextColor] = useState('#F5F8FF');
  const [customDomain, setCustomDomain] = useState('');

  // Tab 3: PWA Form State
  const [pwaShortName, setPwaShortName] = useState('');
  const [pwaThemeColor, setPwaThemeColor] = useState('#1E6BFF');
  const [pwaBgColor, setPwaBgColor] = useState('#071A2F');
  const [pwaDisplay, setPwaDisplay] = useState('standalone');
  const [pwaOrientation, setPwaOrientation] = useState('portrait');

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);

        // Fetch App Geral
        const { data: appData, error: appErr } = await supabase
          .from('apps')
          .select('*')
          .eq('id', appId)
          .single();

        if (appErr) throw appErr;
        if (!appData) throw new Error('Aplicativo não encontrado.');

        setName(appData.name);
        setSlug(appData.slug);
        setDescription(appData.description || '');
        setProductIds(appData.product_ids || '');
        setStatus(appData.status);
        setLogoUrl(appData.logo_url || '');
        setLogoPath(appData.logo_path || '');
        setCoverUrl(appData.cover_url || '');

        // Fetch App Settings (Colors)
        const { data: settingsData, error: settingsError } = await supabase
          .from('app_settings')
          .select('*')
          .eq('app_id', appId)
          .maybeSingle();

        if (settingsError) throw settingsError;
        if (settingsData) {
          setPrimaryColor(settingsData.primary_color);
          setSecondaryColor(settingsData.secondary_color);
          setAccentColor(settingsData.accent_color);
          setBackgroundColor(settingsData.background_color);
          setTextColor(settingsData.text_color);
          setCustomDomain(settingsData.custom_domain || '');
          setCarouselEnabled(Boolean(settingsData.carousel_enabled));
          setSupportEnabled(Boolean(settingsData.support_enabled && settingsData.support_position !== 'hidden'));
          setSupportIconUrl(settingsData.support_icon_url || '');
        }

        // Fetch PWA settings
        const { data: pwaData, error: pwaError } = await supabase
          .from('pwa_settings')
          .select('*')
          .eq('app_id', appId)
          .maybeSingle();

        if (pwaError) throw pwaError;
        if (pwaData) {
          setPwaShortName(pwaData.short_name || '');
          setPwaThemeColor(pwaData.theme_color);
          setPwaBgColor(pwaData.background_color);
          setPwaDisplay(pwaData.display);
          setPwaOrientation(pwaData.orientation);
        }

        const [{ data: moduleData, error: moduleError }, { data: carouselData, error: carouselError }] =
          await Promise.all([
            supabase
              .from('app_modules')
              .select('id, name, cover_image_url, release_type, release_after_days, is_scheduled_release')
              .eq('app_id', appId)
              .order('order_index', { ascending: true }),
            supabase
              .from('app_carousel_images')
              .select('id, image_url, alt_text, is_active')
              .eq('app_id', appId)
              .order('sort_order', { ascending: true }),
          ]);

        if (moduleError) throw moduleError;
        if (carouselError) throw carouselError;
        setPreviewModules(moduleData || []);
        setPreviewCarouselImages(carouselData || []);
      } catch (err: unknown) {
        logTechnicalError('Carregar configurações do app', err);
        setError(getErrorMessage(err, 'Erro ao carregar dados do aplicativo.'));
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [appId, supabase]);

  const uploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validatePublicImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploadingLogo(true);
    setError(null);

    try {
      const path = `apps/${appId}/branding/logo-${sanitizeStorageFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(APP_ASSETS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(APP_ASSETS_BUCKET).getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      setLogoPath(path);
      await saveAdminAppConfiguration(appId, 'audit', {
        auditAction: 'upload_app_logo',
        changes: { logo_path: path },
      });
    } catch (err: unknown) {
      logTechnicalError('Upload da logo do app', err, 'upload');
      setError(getErrorMessage(err, 'Falha ao enviar logo.', 'upload'));
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (activeTab === 'general') {
        await saveAdminAppConfiguration(appId, 'general', {
          name,
          slug,
          description: description.trim() || null,
          productIds: productIds.trim() || null,
          status,
          logoUrl: logoUrl.trim() || null,
          logoPath: logoPath.trim() || null,
          coverUrl: coverUrl.trim() || null,
        });
      } else if (activeTab === 'appearance') {
        await saveAdminAppConfiguration(appId, 'appearance', {
          primaryColor,
          secondaryColor,
          accentColor,
          backgroundColor,
          textColor,
          customDomain: customDomain.trim() || null,
        });
      } else if (activeTab === 'pwa') {
        await saveAdminAppConfiguration(appId, 'pwa', {
          shortName: pwaShortName.trim() || null,
          themeColor: pwaThemeColor,
          backgroundColor: pwaBgColor,
          display: pwaDisplay,
          orientation: pwaOrientation,
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      logTechnicalError('Salvar configurações do app', err);
      setError(getErrorMessage(err, 'Falha ao salvar as alterações.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-gray text-sm">Carregando configurações do aplicativo...</p>
      </div>
    );
  }

  const advancedLinks = [
    { label: 'Editor', href: `/admin/apps/${appId}/editor` },
    { label: 'Marca', href: `/admin/apps/${appId}/branding` },
    { label: 'Carrossel', href: `/admin/apps/${appId}/carousel` },
    { label: 'Suporte', href: `/admin/apps/${appId}/support` },
    { label: 'Avisos', href: `/admin/apps/${appId}/notices` },
    { label: 'Comunidade', href: `/admin/apps/${appId}/community` },
    { label: 'Idiomas', href: `/admin/apps/${appId}/translations` },
    { label: 'Alunos', href: `/admin/apps/${appId}/users` },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-secondary-bg border border-border-color flex items-center justify-center text-light-blue shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={name} className="h-full w-full object-contain p-1" />
            ) : (
              <Layers className="h-6 w-6" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-white">Ajustes — {name}</h2>
            <p className="text-xs text-text-gray mt-0.5">Defina a identidade visual, slug, cores e manifest PWA.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {advancedLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-border-color bg-card-bg/50 px-3 py-2 text-center text-xs font-bold text-text-gray transition hover:border-accent-blue/50 hover:text-text-white"
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border-color/50 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => { setActiveTab('general'); setError(null); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'general'
              ? 'border-accent-blue text-text-white bg-card-bg/15'
              : 'border-transparent text-text-gray hover:text-text-white'
          }`}
        >
          <Settings className="h-4.5 w-4.5" />
          Configurações Gerais
        </button>
        <button
          onClick={() => { setActiveTab('appearance'); setError(null); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'appearance'
              ? 'border-accent-blue text-text-white bg-card-bg/15'
              : 'border-transparent text-text-gray hover:text-text-white'
          }`}
        >
          <Palette className="h-4.5 w-4.5" />
          Branding & Cores
        </button>
        <button
          onClick={() => { setActiveTab('pwa'); setError(null); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'pwa'
              ? 'border-accent-blue text-text-white bg-card-bg/15'
              : 'border-transparent text-text-gray hover:text-text-white'
          }`}
        >
          <Smartphone className="h-4.5 w-4.5" />
          PWA & Mobile
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-4 rounded-xl">
          <p className="font-semibold">Erro ao processar alteração</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs p-4 rounded-xl flex items-center gap-2">
          <Check className="h-4 w-4" />
          Configurações salvas com sucesso!
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_338px]">
      {/* Forms Body */}
      <form onSubmit={handleSave} className="glass-panel space-y-6 rounded-2xl p-6 sm:p-8">
        
        {/* Tab 1: GENERAL */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                  Nome do App
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                  Slug URL
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-text-gray/50">/app/</span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-primary-bg border border-border-color text-text-white pl-14 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm font-mono"
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-primary-bg border border-border-color text-text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                  IDs de Vendas Vinculados (vírgula para múltiplos)
                </label>
                <input
                  type="text"
                  value={productIds}
                  onChange={(e) => setProductIds(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
                >
                  <option value="draft">Rascunho (Privado)</option>
                  <option value="published">Publicado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 border-t border-border-color/20 pt-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                  Logo do app
                </label>
                <div className="flex items-center gap-3 rounded-xl border border-border-color bg-primary-bg p-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-color bg-card-bg text-light-blue">
                    {logoUrl ? (
                      <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <Layers className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text-white">Imagem no header do app</p>
                    <p className="mt-1 text-[10px] text-text-gray">PNG, JPG ou WEBP. Máximo de 5 MB.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent-blue px-3 py-2 text-xs font-bold text-white transition hover:bg-light-blue">
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {logoUrl ? 'Trocar logo' : 'Adicionar logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={uploadLogo}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl('');
                        setLogoPath('');
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                  URL da Capa / Banner
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: APPEARANCE */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-light-blue uppercase tracking-wider border-b border-border-color/30 pb-2">Paleta de Cores do App Final</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
              
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-text-gray uppercase tracking-wider">Cor Principal</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-8 w-8 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-20 bg-primary-bg border border-border-color text-text-white px-2 py-1 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-text-gray uppercase tracking-wider">Fundo Secundário</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-8 w-8 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-20 bg-primary-bg border border-border-color text-text-white px-2 py-1 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-text-gray uppercase tracking-wider">Cor Destaque</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-8 w-8 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-20 bg-primary-bg border border-border-color text-text-white px-2 py-1 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-text-gray uppercase tracking-wider">Cor de Fundo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="h-8 w-8 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-20 bg-primary-bg border border-border-color text-text-white px-2 py-1 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-text-gray uppercase tracking-wider">Cor do Texto</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-8 w-8 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-20 bg-primary-bg border border-border-color text-text-white px-2 py-1 rounded text-xs font-mono"
                  />
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-border-color/20">
              <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                Domínio Customizado (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: app.meusite.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="w-full bg-primary-bg border border-border-color text-text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
              />
            </div>
          </div>
        )}

        {/* Tab 3: PWA */}
        {activeTab === 'pwa' && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-light-blue uppercase tracking-wider border-b border-border-color/30 pb-2">Instalação Mobile PWA</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                  Nome Curto do PWA (Exibido na tela inicial do celular)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={pwaShortName}
                  onChange={(e) => setPwaShortName(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                  Modo de Exibição
                </label>
                <select
                  value={pwaDisplay}
                  onChange={(e) => setPwaDisplay(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue text-sm"
                >
                  <option value="standalone">Standalone (Sem barras do navegador - Recomendado)</option>
                  <option value="fullscreen">Fullscreen (Tela Cheia)</option>
                  <option value="minimal-ui">Minimal UI (Interface Mínima)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-border-color/20">
              
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-text-gray uppercase tracking-wider">Cor de Tema PWA</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={pwaThemeColor}
                    onChange={(e) => setPwaThemeColor(e.target.value)}
                    className="h-8 w-8 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={pwaThemeColor}
                    onChange={(e) => setPwaThemeColor(e.target.value)}
                    className="w-20 bg-primary-bg border border-border-color text-text-white px-2 py-1 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-text-gray uppercase tracking-wider">Cor de Fundo PWA</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={pwaBgColor}
                    onChange={(e) => setPwaBgColor(e.target.value)}
                    className="h-8 w-8 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={pwaBgColor}
                    onChange={(e) => setPwaBgColor(e.target.value)}
                    className="w-20 bg-primary-bg border border-border-color text-text-white px-2 py-1 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-text-gray uppercase tracking-wider">Orientação da Tela</label>
                <select
                  value={pwaOrientation}
                  onChange={(e) => setPwaOrientation(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-3 py-1.5 rounded text-xs"
                >
                  <option value="portrait">Retrato (Portrait)</option>
                  <option value="landscape">Paisagem (Landscape)</option>
                  <option value="any">Qualquer Orientação</option>
                </select>
              </div>

            </div>
          </div>
        )}

        {/* Save button footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border-color/30 pt-6">
          <button
            type="submit"
            disabled={saving || uploadingLogo}
            className="bg-accent-blue hover:bg-light-blue disabled:bg-accent-blue/50 text-text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 shadow-lg shadow-accent-blue/15"
          >
            {saving ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4.5 w-4.5" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>

      </form>

      <AppPreviewPhone
        name={name}
        description={description}
        logoUrl={logoUrl}
        coverUrl={coverUrl}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        accentColor={accentColor}
        backgroundColor={backgroundColor}
        textColor={textColor}
        carouselEnabled={carouselEnabled}
        carouselImages={previewCarouselImages}
        modules={previewModules}
        supportEnabled={supportEnabled}
        supportIconUrl={supportIconUrl}
      />
      </div>

    </div>
  );
}
