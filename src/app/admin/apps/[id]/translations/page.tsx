'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { FIXED_TEXT, LANGUAGE_OPTIONS, getFixedText } from '@/lib/app-experience';
import { getErrorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

const TRANSLATION_KEYS = [
  'home',
  'community',
  'notices',
  'support',
  'profile',
  'login',
  'logout',
  'availableNow',
  'unlockInDays',
  'unlockTomorrow',
  'unlockToday',
  'moduleBlocked',
  'myProfile',
  'name',
  'email',
  'saveChanges',
  'accessActive',
  'accessBlocked',
  'noContent',
];

export default function AdminAppTranslationsPage() {
  const { id: appId } = useParams() as { id: string };
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [languageCode, setLanguageCode] = useState<'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR'>('pt-BR');
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTranslations() {
      setLoading(true);

      const { data } = await supabase
        .from('app_translations')
        .select('key, value')
        .eq('app_id', appId)
        .eq('language_code', languageCode)
        .eq('namespace', 'app');

      const loaded = (data || []).reduce<Record<string, string>>((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {});

      setValues(
        TRANSLATION_KEYS.reduce<Record<string, string>>((acc, key) => {
          acc[key] = loaded[key] || getFixedText(languageCode, key, { days: 7 });
          return acc;
        }, {})
      );
      setLoading(false);
    }

    loadTranslations();
  }, [appId, languageCode, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const rows = TRANSLATION_KEYS.map((key) => ({
        app_id: appId,
        language_code: languageCode,
        namespace: 'app',
        key,
        value: values[key] || FIXED_TEXT[languageCode][key] || key,
      }));

      const { error: upsertError } = await supabase
        .from('app_translations')
        .upsert(rows, { onConflict: 'app_id,language_code,namespace,key' });

      if (upsertError) throw upsertError;

      await supabase.from('audit_logs').insert({
        action: 'app_translations_updated',
        details: { app_id: appId, language_code: languageCode },
      });

      setMessage('Traducoes salvas.');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/apps/${appId}/settings`} className="rounded-xl border border-border-color bg-card-bg p-2 text-text-gray hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-text-white">Idiomas e textos</h2>
          <p className="text-sm text-text-gray">Edite os textos fixos do app final por idioma.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border-color bg-secondary-bg p-6">
        <label className="block max-w-xs space-y-1.5 text-xs">
          <span className="font-semibold text-text-gray">Idioma</span>
          <select value={languageCode} onChange={(event) => setLanguageCode(event.target.value as 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR')} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue">
            {LANGUAGE_OPTIONS.map((language) => (
              <option key={language.code} value={language.code}>{language.label}</option>
            ))}
          </select>
        </label>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-gray">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando textos...
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {TRANSLATION_KEYS.map((key) => (
              <label key={key} className="space-y-1.5 text-xs">
                <span className="font-mono font-semibold text-text-gray">{key}</span>
                <input
                  value={values[key] || ''}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                  className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue"
                />
              </label>
            ))}
          </div>
        )}

        {message && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{message}</p>}
        {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}

        <button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-5 py-3 text-sm font-bold text-white hover:bg-light-blue disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar traducoes
        </button>
      </form>
    </div>
  );
}
