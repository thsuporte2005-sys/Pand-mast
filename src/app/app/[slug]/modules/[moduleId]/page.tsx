'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Lock, PlayCircle } from 'lucide-react';
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
  cover_image_url?: string | null;
  cover_alt_text?: string | null;
  release_type?: string | null;
  release_after_days?: number | null;
  is_scheduled_release?: boolean | null;
}

interface LessonRecord {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
}

export default function AppModuleDetailPage() {
  const { slug, moduleId } = useParams() as { slug: string; moduleId: string };
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [app, setApp] = useState<AppRecord | null>(null);
  const [settings, setSettings] = useState<AppSettingsRecord | null>(null);
  const [access, setAccess] = useState<AccessGrant | null>(null);
  const [moduleItem, setModuleItem] = useState<ModuleRecord | null>(null);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadModule() {
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

        const { data: loadedModule } = await supabase
          .from('app_modules')
          .select('*')
          .eq('id', moduleId)
          .eq('app_id', appData.id)
          .single();

        if (!loadedModule) {
          router.push(`/app/${slug}/modules`);
          return;
        }

        setModuleItem(loadedModule);

        const { data: lessonData } = await supabase
          .from('app_lessons')
          .select('id, title, description, order_index')
          .eq('module_id', moduleId)
          .eq('is_published', true)
          .order('order_index', { ascending: true });

        setLessons(lessonData || []);
      } finally {
        setLoading(false);
      }
    }

    loadModule();
  }, [moduleId, router, slug, supabase]);

  if (loading || !app || !moduleItem) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#071A2F] text-[#F5F8FF]">
        <Loader2 className="h-10 w-10 animate-spin text-[#1E6BFF]" />
        <p className="text-xs text-[#9BAEC8]">Carregando aulas...</p>
      </div>
    );
  }

  const language = app.default_language || 'pt-BR';
  const releaseState = getModuleReleaseState(moduleItem, access, language, now);
  const brandName = settings?.display_name || app.display_name || app.name;

  return (
    <div className="min-h-screen bg-[#071A2F] pb-28 text-[#F5F8FF]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href={`/app/${slug}/modules`} className="flex items-center gap-1.5 text-xs text-[#9BAEC8] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Modulos
          </Link>
          <span className="truncate text-sm font-bold">{brandName}</span>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-4xl space-y-5 px-4">
        <ModuleCover
          title={moduleItem.name}
          imageUrl={moduleItem.cover_image_url}
          altText={moduleItem.cover_alt_text}
          locked={!releaseState.isUnlocked}
          className="h-52"
        />

        <section className="rounded-2xl border border-[#1B3554] bg-[#0E223A] p-5">
          <h1 className="text-xl font-bold">{moduleItem.name}</h1>
          <p className="mt-1 text-xs text-[#9BAEC8]">
            {moduleItem.description || 'Aulas disponiveis neste modulo.'}
          </p>

          {!releaseState.isUnlocked && (
            <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs text-amber-100">
              <div className="flex items-center gap-2 font-bold">
                <Lock className="h-4 w-4" />
                {releaseState.label}
              </div>
              <p className="mt-1 text-amber-100/80">
                Este modulo sera liberado automaticamente quando a data programada chegar.
              </p>
            </div>
          )}
        </section>

        {releaseState.isUnlocked && (
          <section className="grid gap-3">
            {lessons.length === 0 ? (
              <div className="rounded-2xl border border-[#1B3554] bg-[#0E223A] p-8 text-center text-xs text-[#9BAEC8]">
                Nenhuma aula publicada neste modulo.
              </div>
            ) : (
              lessons.map((lesson, index) => (
                <Link
                  key={lesson.id}
                  href={`/app/${slug}/lessons/${lesson.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-[#1B3554] bg-[#0E223A] p-4 transition hover:border-[#1E6BFF]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1B3554] bg-[#0B2A4A] text-[#4DA3FF]">
                    <PlayCircle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#9BAEC8]">Aula {index + 1}</p>
                    <h2 className="truncate text-sm font-bold">{lesson.title}</h2>
                    {lesson.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-[#9BAEC8]">{lesson.description}</p>
                    )}
                  </div>
                </Link>
              ))
            )}
          </section>
        )}
      </main>

      <AppSupportButton settings={settings} />
      <AppBottomNav language={language} />
    </div>
  );
}
