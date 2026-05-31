'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle, Layers, Loader2, Lock } from 'lucide-react';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppSupportButton } from '@/components/app-support-button';
import { ModuleCover } from '@/components/module-cover';
import { getModuleReleaseState, type AccessGrant } from '@/lib/app-experience';
import { createClient } from '@/lib/supabase/client';
import type { AppRecord, AppSettingsRecord } from '@/lib/types';

interface ModuleRecord {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  cover_image_url?: string | null;
  cover_alt_text?: string | null;
  release_type?: string | null;
  release_after_days?: number | null;
  is_scheduled_release?: boolean | null;
}

interface LessonRecord {
  id: string;
  module_id: string;
  title: string;
  is_published: boolean;
}

export default function AppModulesPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [app, setApp] = useState<AppRecord | null>(null);
  const [settings, setSettings] = useState<AppSettingsRecord | null>(null);
  const [access, setAccess] = useState<AccessGrant | null>(null);
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadModules() {
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

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push(`/app/${slug}/login`);
          return;
        }

        const { data: adminCheck } = await supabase
          .from('admins')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        const { data: accessData } = await supabase
          .from('user_app_access')
          .select('status, granted_at, access_granted_at')
          .eq('user_id', user.id)
          .eq('app_id', appData.id)
          .maybeSingle();

        setAccess(
          adminCheck
            ? { status: 'active', access_granted_at: '2000-01-01T00:00:00.000Z' }
            : accessData
        );

        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('*')
          .eq('app_id', appData.id)
          .maybeSingle();

        setSettings(settingsData);

        const { data: moduleData } = await supabase
          .from('app_modules')
          .select('*')
          .eq('app_id', appData.id)
          .order('order_index', { ascending: true });

        const loadedModules = moduleData || [];
        setModules(loadedModules);

        if (loadedModules.length > 0) {
          const { data: lessonData } = await supabase
            .from('app_lessons')
            .select('id, module_id, title, is_published')
            .in(
              'module_id',
              loadedModules.map((moduleItem) => moduleItem.id)
            )
            .eq('is_published', true);

          setLessons(lessonData || []);
        }
      } finally {
        setLoading(false);
      }
    }

    loadModules();
  }, [router, slug, supabase]);

  if (loading || !app) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#071A2F] text-[#F5F8FF]">
        <Loader2 className="h-10 w-10 animate-spin text-[#1E6BFF]" />
        <p className="text-xs text-[#9BAEC8]">Carregando modulos...</p>
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
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Modulos</h1>
            <p className="text-xs text-[#9BAEC8]">Veja o que ja esta disponivel e o que libera em breve.</p>
          </div>
        </div>

        {modules.length === 0 ? (
          <div className="rounded-2xl border border-[#1B3554] bg-[#0E223A] p-8 text-center text-xs text-[#9BAEC8]">
            Nenhum conteudo disponivel.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((moduleItem) => {
              const lessonCount = lessons.filter((lesson) => lesson.module_id === moduleItem.id).length;
              const releaseState = getModuleReleaseState(moduleItem, access, language, now);
              const card = (
                <div className="h-full rounded-2xl border border-[#1B3554] bg-[#0E223A] p-4 transition hover:border-[#1E6BFF]">
                  <ModuleCover
                    title={moduleItem.name}
                    imageUrl={moduleItem.cover_image_url}
                    altText={moduleItem.cover_alt_text}
                    locked={!releaseState.isUnlocked}
                    className="mb-4 h-36"
                  />
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-sm font-bold">{moduleItem.name}</h2>
                      <p className="mt-1 line-clamp-2 text-xs text-[#9BAEC8]">
                        {moduleItem.description || 'Conteudos disponiveis para este modulo.'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#4DA3FF]">
                        <BookOpen className="h-3.5 w-3.5" />
                        {lessonCount} aulas
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
                          releaseState.isUnlocked
                            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                            : 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                        }`}
                      >
                        {releaseState.isUnlocked ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                        {releaseState.label}
                      </span>
                    </div>
                  </div>
                </div>
              );

              return releaseState.isUnlocked ? (
                <Link key={moduleItem.id} href={`/app/${slug}/modules/${moduleItem.id}`} className="block">
                  {card}
                </Link>
              ) : (
                <div key={moduleItem.id}>{card}</div>
              );
            })}
          </div>
        )}
      </main>

      <AppSupportButton settings={settings} />
      <AppBottomNav language={language} />
    </div>
  );
}
