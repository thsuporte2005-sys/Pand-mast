'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, LifeBuoy, Loader2 } from 'lucide-react';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppSupportButton } from '@/components/app-support-button';
import { buildSupportHref } from '@/lib/app-experience';
import { createClient } from '@/lib/supabase/client';
import type { AppRecord, AppSettingsRecord } from '@/lib/types';

export default function AppSupportPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [app, setApp] = useState<AppRecord | null>(null);
  const [settings, setSettings] = useState<AppSettingsRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSupport() {
      try {
        const { data: appData, error: appError } = await supabase
          .from('apps')
          .select('*')
          .eq('slug', slug)
          .single();

        if (appError || !appData) {
          router.push(`/app/${slug}`);
          return;
        }

        setApp(appData);

        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('*')
          .eq('app_id', appData.id)
          .maybeSingle();

        setSettings(settingsData);
      } finally {
        setLoading(false);
      }
    }

    loadSupport();
  }, [router, slug, supabase]);

  if (loading || !app) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#071A2F] text-[#F5F8FF]">
        <Loader2 className="h-10 w-10 animate-spin text-[#1E6BFF]" />
        <p className="text-xs text-[#9BAEC8]">Carregando suporte...</p>
      </div>
    );
  }

  const language = app.default_language || 'pt-BR';
  const brandName = settings?.display_name || app.display_name || app.name;
  const supportHref = buildSupportHref(settings);
  const supportLabel = settings?.support_button_text || 'Falar com suporte';

  return (
    <div className="min-h-screen bg-[#071A2F] pb-28 text-[#F5F8FF]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href={`/app/${slug}/home`} className="flex items-center gap-1.5 text-xs text-[#9BAEC8] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Inicio
          </Link>
          <span className="truncate text-sm font-bold">{brandName}</span>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-2xl px-4">
        <section className="rounded-2xl border border-[#1B3554] bg-[#0E223A] p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[#1B3554] bg-[#0B2A4A] text-[#4DA3FF]">
            {settings?.support_icon_url ? (
              <img src={settings.support_icon_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <LifeBuoy className="h-7 w-7" />
            )}
          </div>
          <h1 className="mt-4 text-xl font-bold">Suporte</h1>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#9BAEC8]">
            Use o canal configurado para falar com a equipe deste app.
          </p>

          {supportHref ? (
            <a
              href={supportHref}
              target={supportHref.startsWith('http') ? '_blank' : undefined}
              rel={supportHref.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E6BFF] px-5 py-3 text-sm font-bold transition hover:bg-[#4DA3FF]"
            >
              {supportLabel}
              {supportHref.startsWith('http') && <ExternalLink className="h-4 w-4" />}
            </a>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-[#1B3554] p-5 text-xs text-[#9BAEC8]">
              O suporte ainda nao foi configurado para este app.
            </div>
          )}
        </section>
      </main>

      <AppSupportButton settings={settings} />
      <AppBottomNav language={language} />
    </div>
  );
}
