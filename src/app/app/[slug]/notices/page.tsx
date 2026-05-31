'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppSupportButton } from '@/components/app-support-button';
import { createClient } from '@/lib/supabase/client';
import type { AppRecord, AppSettingsRecord } from '@/lib/types';

interface NoticeRecord {
  id: string;
  title: string;
  content: string | null;
  language_code: string;
  created_at: string;
}

export default function AppNoticesPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [app, setApp] = useState<AppRecord | null>(null);
  const [settings, setSettings] = useState<AppSettingsRecord | null>(null);
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotices() {
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

        const { data: noticeData } = await supabase
          .from('app_notices')
          .select('id, title, content, language_code, created_at')
          .eq('app_id', appData.id)
          .eq('is_published', true)
          .in('language_code', [appData.default_language || 'pt-BR', 'pt-BR'])
          .order('created_at', { ascending: false });

        setNotices(noticeData || []);
      } finally {
        setLoading(false);
      }
    }

    loadNotices();
  }, [router, slug, supabase]);

  if (loading || !app) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#071A2F] text-[#F5F8FF]">
        <Loader2 className="h-10 w-10 animate-spin text-[#1E6BFF]" />
        <p className="text-xs text-[#9BAEC8]">Carregando avisos...</p>
      </div>
    );
  }

  const language = app.default_language || 'pt-BR';
  const brandName = settings?.display_name || app.display_name || app.name;

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

      <main className="mx-auto mt-6 max-w-4xl space-y-5 px-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[#1B3554] bg-[#0E223A] p-3 text-[#4DA3FF]">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Avisos</h1>
            <p className="text-xs text-[#9BAEC8]">Comunicados recentes deste app.</p>
          </div>
        </div>

        {notices.length === 0 ? (
          <div className="rounded-2xl border border-[#1B3554] bg-[#0E223A] p-8 text-center text-xs text-[#9BAEC8]">
            Nenhum aviso publicado.
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((notice) => (
              <article key={notice.id} className="rounded-2xl border border-[#1B3554] bg-[#0E223A] p-5">
                <p className="text-[10px] text-[#9BAEC8]">
                  {new Date(notice.created_at).toLocaleDateString('pt-BR')}
                </p>
                <h2 className="mt-2 text-base font-bold">{notice.title}</h2>
                {notice.content && <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[#9BAEC8]">{notice.content}</p>}
              </article>
            ))}
          </div>
        )}
      </main>

      <AppSupportButton settings={settings} />
      <AppBottomNav language={language} />
    </div>
  );
}
