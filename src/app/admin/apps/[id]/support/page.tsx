'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft, Image as ImageIcon, Loader2, Save } from 'lucide-react';
import { saveAdminAppConfiguration } from '@/lib/admin/app-configuration';
import { sanitizeStorageFileName, validatePublicImage } from '@/lib/app-experience';
import { getErrorMessage, logTechnicalError } from '@/lib/errors';
import { APP_ASSETS_BUCKET } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';

const supportSchema = z
  .object({
    supportEnabled: z.boolean(),
    supportType: z.enum(['whatsapp', 'email', 'external_link']),
    supportWhatsapp: z.string().optional(),
    supportEmail: z.string().email('Email de suporte invalido.').optional().or(z.literal('')),
    supportExternalUrl: z.string().url('Link externo invalido.').optional().or(z.literal('')),
    supportButtonText: z.string().min(2, 'Informe o texto do botao.'),
  })
  .superRefine((values, ctx) => {
    if (!values.supportEnabled) return;
    if (values.supportType === 'whatsapp' && !values.supportWhatsapp?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Informe o WhatsApp do suporte.', path: ['supportWhatsapp'] });
    }
    if (values.supportType === 'email' && !values.supportEmail?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Informe o email do suporte.', path: ['supportEmail'] });
    }
    if (values.supportType === 'external_link' && !values.supportExternalUrl?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Informe o link externo do suporte.', path: ['supportExternalUrl'] });
    }
  });

export default function AdminAppSupportPage() {
  const { id: appId } = useParams() as { id: string };
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supportEnabled, setSupportEnabled] = useState(false);
  const [supportType, setSupportType] = useState<'whatsapp' | 'email' | 'external_link'>('whatsapp');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportExternalUrl, setSupportExternalUrl] = useState('');
  const [supportButtonText, setSupportButtonText] = useState('Falar com suporte');
  const [supportIconUrl, setSupportIconUrl] = useState('');
  const [supportIconPath, setSupportIconPath] = useState('');
  const [showFloating, setShowFloating] = useState(true);

  useEffect(() => {
    async function loadSupport() {
      try {
        const { data: settings, error: settingsError } = await supabase
          .from('app_settings')
          .select('*')
          .eq('app_id', appId)
          .maybeSingle();

        if (settingsError) throw settingsError;
        if (settings) {
          setSupportEnabled(Boolean(settings.support_enabled));
          setSupportType(settings.support_type || 'whatsapp');
          setSupportWhatsapp(settings.support_whatsapp || '');
          setSupportEmail(settings.support_email || '');
          setSupportExternalUrl(settings.support_external_url || '');
          setSupportButtonText(settings.support_button_text || 'Falar com suporte');
          setSupportIconUrl(settings.support_icon_url || '');
          setSupportIconPath(settings.support_icon_path || '');
          setShowFloating(settings.support_position !== 'hidden');
        }
      } catch (err: unknown) {
        logTechnicalError('Carregar suporte do app', err);
        setError(getErrorMessage(err, 'Falha ao carregar suporte.'));
      } finally {
        setLoading(false);
      }
    }

    loadSupport();
  }, [appId, supabase]);

  const uploadIcon = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validatePublicImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const path = `apps/${appId}/support/${sanitizeStorageFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(APP_ASSETS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(APP_ASSETS_BUCKET).getPublicUrl(path);
      setSupportIconUrl(data.publicUrl);
      setSupportIconPath(path);
      await saveAdminAppConfiguration(appId, 'audit', {
        auditAction: 'upload_support_icon',
        changes: { support_icon_path: path },
      });
    } catch (err: unknown) {
      logTechnicalError('Upload do ícone de suporte', err, 'upload');
      setError(getErrorMessage(err, 'Falha ao enviar ícone de suporte.', 'upload'));
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
      const parsed = supportSchema.parse({
        supportEnabled,
        supportType,
        supportWhatsapp,
        supportEmail,
        supportExternalUrl,
        supportButtonText,
      });

      await saveAdminAppConfiguration(appId, 'support', {
        supportEnabled,
        supportType: parsed.supportType,
        supportWhatsapp: parsed.supportWhatsapp?.trim() || null,
        supportEmail: parsed.supportEmail?.trim() || null,
        supportExternalUrl: parsed.supportExternalUrl?.trim() || null,
        supportButtonText: parsed.supportButtonText.trim(),
        supportIconUrl: supportIconUrl || null,
        supportIconPath: supportIconPath || null,
        supportPosition: showFloating ? 'bottom_right' : 'hidden',
      });

      setMessage('Configuracao de suporte salva.');
    } catch (err: unknown) {
      logTechnicalError('Salvar suporte do app', err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-accent-blue" />
        <p className="text-sm text-text-gray">Carregando suporte...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/apps/${appId}/settings`} className="rounded-xl border border-border-color bg-card-bg p-2 text-text-gray hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-text-white">Suporte do app</h2>
          <p className="text-sm text-text-gray">Configure WhatsApp, email ou link externo exibido no app final.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border-color bg-secondary-bg p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-border-color bg-primary-bg p-4 text-xs text-text-white">
            <input type="checkbox" checked={supportEnabled} onChange={(event) => setSupportEnabled(event.target.checked)} />
            Suporte ativo
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border-color bg-primary-bg p-4 text-xs text-text-white">
            <input type="checkbox" checked={showFloating} onChange={(event) => setShowFloating(event.target.checked)} />
            Exibir botao flutuante
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Tipo de suporte</span>
            <select value={supportType} onChange={(event) => setSupportType(event.target.value as 'whatsapp' | 'email' | 'external_link')} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="external_link">Link externo</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Texto do botao</span>
            <input value={supportButtonText} onChange={(event) => setSupportButtonText(event.target.value)} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
          </label>
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Numero do WhatsApp</span>
            <input value={supportWhatsapp} onChange={(event) => setSupportWhatsapp(event.target.value)} placeholder="5599999999999" className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
          </label>
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Email de suporte</span>
            <input value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="suporte@empresa.com" className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
          </label>
          <label className="space-y-1.5 text-xs sm:col-span-2">
            <span className="font-semibold text-text-gray">Link externo</span>
            <input value={supportExternalUrl} onChange={(event) => setSupportExternalUrl(event.target.value)} placeholder="https://..." className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
          </label>
        </div>

        <div className="rounded-2xl border border-border-color bg-card-bg/40 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border-color bg-primary-bg text-light-blue">
              {supportIconUrl ? <img src={supportIconUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm font-bold text-text-white">Icone/foto do suporte</p>
              <p className="text-[11px] text-text-gray">Opcional, usado no botao flutuante e pagina de suporte.</p>
            </div>
          </div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadIcon} className="block w-full text-xs text-text-gray file:mr-3 file:rounded-lg file:border-0 file:bg-accent-blue file:px-3 file:py-2 file:text-xs file:font-bold file:text-white" />
        </div>

        {uploading && <p className="text-xs text-light-blue">Enviando icone...</p>}
        {message && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{message}</p>}
        {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}

        <button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-light-blue disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar suporte
        </button>
      </form>
    </div>
  );
}
