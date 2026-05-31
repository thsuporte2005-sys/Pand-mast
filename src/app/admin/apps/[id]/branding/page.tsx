'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft, Image as ImageIcon, Loader2, Save } from 'lucide-react';
import {
  BRAND_FONT_OPTIONS,
  LANGUAGE_OPTIONS,
  sanitizeStorageFileName,
  validatePublicImage,
} from '@/lib/app-experience';
import { getErrorMessage } from '@/lib/errors';
import { PUBLIC_MEDIA_BUCKET } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';

const brandingSchema = z.object({
  name: z.string().min(2, 'Informe o nome do app.'),
  displayName: z.string().optional(),
  subtitle: z.string().optional(),
  brandMode: z.enum(['text', 'image']),
  brandFont: z.string().min(1),
  defaultLanguage: z.enum(['pt-BR', 'en-US', 'es-ES', 'fr-FR']),
});

export default function AdminAppBrandingPage() {
  const { id: appId } = useParams() as { id: string };
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [brandMode, setBrandMode] = useState<'text' | 'image'>('text');
  const [brandFont, setBrandFont] = useState('Inter');
  const [defaultLanguage, setDefaultLanguage] = useState<'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR'>('pt-BR');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPath, setLogoPath] = useState('');
  const [squareIconUrl, setSquareIconUrl] = useState('');
  const [squareIconPath, setSquareIconPath] = useState('');

  useEffect(() => {
    async function loadBranding() {
      try {
        const { data: app } = await supabase
          .from('apps')
          .select('*')
          .eq('id', appId)
          .single();

        const { data: settings } = await supabase
          .from('app_settings')
          .select('*')
          .eq('app_id', appId)
          .maybeSingle();

        if (app) {
          setName(app.name || '');
          setDisplayName(settings?.display_name || app.display_name || app.name || '');
          setSubtitle(settings?.subtitle || app.subtitle || app.description || '');
          setBrandMode((settings?.brand_mode || app.brand_mode || 'text') === 'image' ? 'image' : 'text');
          setBrandFont(settings?.brand_font || app.brand_font || 'Inter');
          setDefaultLanguage(app.default_language || 'pt-BR');
          setLogoUrl(settings?.logo_url || app.logo_url || '');
          setLogoPath(settings?.logo_path || app.logo_path || '');
          setSquareIconUrl(settings?.square_icon_url || app.square_icon_url || '');
          setSquareIconPath(settings?.square_icon_path || app.square_icon_path || '');
        }
      } finally {
        setLoading(false);
      }
    }

    loadBranding();
  }, [appId, supabase]);

  const uploadImage = async (file: File | undefined, target: 'logo' | 'square') => {
    if (!file) return;

    const validationError = validatePublicImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const path = `apps/${appId}/branding/${target}-${sanitizeStorageFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(path);

      if (target === 'logo') {
        setLogoUrl(data.publicUrl);
        setLogoPath(path);
      } else {
        setSquareIconUrl(data.publicUrl);
        setSquareIconPath(path);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const parsed = brandingSchema.parse({
        name,
        displayName,
        subtitle,
        brandMode,
        brandFont,
        defaultLanguage,
      });

      const appPayload = {
        name: parsed.name.trim(),
        display_name: parsed.displayName?.trim() || parsed.name.trim(),
        subtitle: parsed.subtitle?.trim() || null,
        logo_url: logoUrl || null,
        logo_path: logoPath || null,
        square_icon_url: squareIconUrl || null,
        square_icon_path: squareIconPath || null,
        brand_mode: parsed.brandMode,
        brand_font: parsed.brandFont,
        default_language: parsed.defaultLanguage,
        updated_at: new Date().toISOString(),
      };

      const { error: appError } = await supabase.from('apps').update(appPayload).eq('id', appId);
      if (appError) throw appError;

      const { data: existingSettings } = await supabase
        .from('app_settings')
        .select('primary_color, secondary_color, accent_color, background_color, text_color')
        .eq('app_id', appId)
        .maybeSingle();

      const { error: settingsError } = await supabase.from('app_settings').upsert({
        app_id: appId,
        primary_color: existingSettings?.primary_color || '#1E6BFF',
        secondary_color: existingSettings?.secondary_color || '#0B2A4A',
        accent_color: existingSettings?.accent_color || '#4DA3FF',
        background_color: existingSettings?.background_color || '#071A2F',
        text_color: existingSettings?.text_color || '#F5F8FF',
        display_name: appPayload.display_name,
        subtitle: appPayload.subtitle,
        logo_url: appPayload.logo_url,
        logo_path: appPayload.logo_path,
        square_icon_url: appPayload.square_icon_url,
        square_icon_path: appPayload.square_icon_path,
        brand_mode: appPayload.brand_mode,
        brand_font: appPayload.brand_font,
      });

      if (settingsError) throw settingsError;

      await supabase.from('audit_logs').insert({
        action: 'app_branding_updated',
        details: { app_id: appId },
      });

      setMessage('Branding salvo com sucesso.');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-accent-blue" />
        <p className="text-sm text-text-gray">Carregando marca do app...</p>
      </div>
    );
  }

  const imageField = (
    label: string,
    url: string,
    target: 'logo' | 'square',
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
  ) => (
    <div className="rounded-2xl border border-border-color bg-card-bg/40 p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border-color bg-primary-bg text-light-blue">
          {url ? <img src={url} alt={label} className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6" />}
        </div>
        <div>
          <p className="text-sm font-bold text-text-white">{label}</p>
          <p className="text-[11px] text-text-gray">{target === 'square' ? 'Ideal 1080x1080 para PWA.' : 'Usado no topo do app final.'}</p>
        </div>
      </div>
      <input
        type="file"
        accept="image/*"
        onChange={onChange}
        className="block w-full text-xs text-text-gray file:mr-3 file:rounded-lg file:border-0 file:bg-accent-blue file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/apps/${appId}/settings`} className="rounded-xl border border-border-color bg-card-bg p-2 text-text-gray hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-text-white">Marca e PWA</h2>
          <p className="text-sm text-text-gray">Configure nome, logo, icone e idioma principal do app final.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border-color bg-secondary-bg p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Nome interno do app</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
          </label>
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Nome exibido</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
          </label>
          <label className="space-y-1.5 text-xs sm:col-span-2">
            <span className="font-semibold text-text-gray">Subtitulo curto</span>
            <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
          </label>
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Modo da marca</span>
            <select value={brandMode} onChange={(event) => setBrandMode(event.target.value as 'text' | 'image')} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue">
              <option value="text">Texto</option>
              <option value="image">Imagem</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Fonte do nome</span>
            <select value={brandFont} onChange={(event) => setBrandFont(event.target.value)} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue">
              {BRAND_FONT_OPTIONS.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Idioma principal</span>
            <select value={defaultLanguage} onChange={(event) => setDefaultLanguage(event.target.value as 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR')} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue">
              {LANGUAGE_OPTIONS.map((language) => (
                <option key={language.code} value={language.code}>{language.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {imageField('Logo do app', logoUrl, 'logo', (event) => uploadImage(event.target.files?.[0], 'logo'))}
          {imageField('Icone quadrado', squareIconUrl, 'square', (event) => uploadImage(event.target.files?.[0], 'square'))}
        </div>

        {uploading && <p className="text-xs text-light-blue">Enviando imagem...</p>}
        {message && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{message}</p>}
        {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}

        <button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-light-blue disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar marca
        </button>
      </form>
    </div>
  );
}
