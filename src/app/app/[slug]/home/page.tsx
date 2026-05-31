'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Award,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  Layers,
  Loader2,
  Lock,
  LogOut,
  PlayCircle,
} from 'lucide-react';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppInstallButton } from '@/components/app-install-button';
import { AppSupportButton } from '@/components/app-support-button';
import { ModuleCover } from '@/components/module-cover';
import {
  getFixedText,
  getModuleReleaseState,
  type AccessGrant,
} from '@/lib/app-experience';
import { createClient } from '@/lib/supabase/client';
import type { AppRecord, AppSettingsRecord, AppTheme } from '@/lib/types';

interface Module {
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

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_provider: string;
  order_index: number;
  is_published: boolean;
}

interface CarouselImage {
  id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
}

type TranslationMap = Record<string, string>;

function formatTranslatedText(value: string, dynamicValues?: Record<string, string | number>) {
  if (!dynamicValues) return value;

  return Object.entries(dynamicValues).reduce(
    (current, [key, replacement]) => current.replace(`{${key}}`, String(replacement)),
    value
  );
}

export default function AppHomePage() {
  const router = useRouter();
  const { slug } = useParams() as { slug: string };
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<AppRecord | null>(null);
  const [settings, setSettings] = useState<AppSettingsRecord | null>(null);
  const [access, setAccess] = useState<AccessGrant | null>(null);
  const [colors, setColors] = useState<AppTheme>({
    primary_color: '#1E6BFF',
    secondary_color: '#0B2A4A',
    accent_color: '#4DA3FF',
    background_color: '#071A2F',
    text_color: '#F5F8FF',
  });
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [carouselImages, setCarouselImages] = useState<CarouselImage[]>([]);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [studentName, setStudentName] = useState('Aluno');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadAppData() {
      try {
        setLoading(true);

        const { data: appData, error: appErr } = await supabase
          .from('apps')
          .select('*')
          .eq('slug', slug)
          .single();

        if (appErr || !appData) {
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

        const { data: accessData } = await supabase
          .from('user_app_access')
          .select('status, granted_at, access_granted_at')
          .eq('user_id', user.id)
          .eq('app_id', appData.id)
          .maybeSingle();

        const { data: adminCheck } = await supabase
          .from('admins')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (!adminCheck && (!accessData || accessData.status !== 'active')) {
          router.push(`/app/${slug}/login?error=no-access`);
          return;
        }

        setAccess(
          adminCheck
            ? { status: 'active', access_granted_at: '2000-01-01T00:00:00.000Z' }
            : accessData
        );

        const { data: profile } = await supabase
          .from('final_users')
          .select('name')
          .eq('id', user.id)
          .maybeSingle();

        setStudentName(profile?.name || user.email?.split('@')[0] || 'Aluno');

        const localProgress = window.localStorage.getItem(`progress_${user.id}_${appData.id}`);
        if (localProgress) {
          setCompletedLessonIds(JSON.parse(localProgress));
        }

        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('*')
          .eq('app_id', appData.id)
          .maybeSingle();

        if (settingsData) {
          setSettings(settingsData);
          setColors({
            primary_color: settingsData.primary_color,
            secondary_color: settingsData.secondary_color,
            accent_color: settingsData.accent_color,
            background_color: settingsData.background_color,
            text_color: settingsData.text_color,
          });
        }

        const language = appData.default_language || 'pt-BR';
        const { data: translationRows } = await supabase
          .from('app_translations')
          .select('key, value')
          .eq('app_id', appData.id)
          .eq('language_code', language)
          .eq('namespace', 'app');

        setTranslations(
          (translationRows || []).reduce<TranslationMap>((acc, row) => {
            acc[row.key] = row.value;
            return acc;
          }, {})
        );

        const { data: modulesData } = await supabase
          .from('app_modules')
          .select('*')
          .eq('app_id', appData.id)
          .order('order_index', { ascending: true });

        const loadedModules = modulesData || [];
        setModules(loadedModules);
        setExpandedModuleId(loadedModules[0]?.id || null);

        if (loadedModules.length > 0) {
          const { data: lessonsData } = await supabase
            .from('app_lessons')
            .select('*')
            .in(
              'module_id',
              loadedModules.map((moduleItem) => moduleItem.id)
            )
            .eq('is_published', true)
            .order('order_index', { ascending: true });

          setLessons(lessonsData || []);
        } else {
          setLessons([]);
        }

        if (settingsData?.carousel_enabled) {
          const { data: carouselData } = await supabase
            .from('app_carousel_images')
            .select('id, image_url, alt_text, sort_order')
            .eq('app_id', appData.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

          setCarouselImages(carouselData || []);
        } else {
          setCarouselImages([]);
        }
      } catch (err) {
        console.error('Error loading app home:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAppData();
  }, [router, slug, supabase]);

  const language = app?.default_language || 'pt-BR';
  const t = (key: string, dynamicValues?: Record<string, string | number>) =>
    translations[key]
      ? formatTranslatedText(translations[key], dynamicValues)
      : getFixedText(language, key, dynamicValues);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(`/app/${slug}/login`);
  };

  if (loading || !app) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#071A2F] text-[#F5F8FF]">
        <Loader2 className="h-10 w-10 animate-spin text-[#1E6BFF]" />
        <p className="text-xs text-[#9BAEC8]">Montando painel de aulas...</p>
      </div>
    );
  }

  const themeStyles = {
    '--app-bg': colors.background_color,
    '--app-card': colors.secondary_color,
    '--app-primary': colors.primary_color,
    '--app-accent': colors.accent_color,
    '--app-text': colors.text_color,
  } as React.CSSProperties;

  const totalLessons = lessons.length;
  const completedCount = lessons.filter((lesson) => completedLessonIds.includes(lesson.id)).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const brandName = settings?.display_name || app.display_name || app.name;
  const brandSubtitle = settings?.subtitle || app.subtitle || app.description;
  const brandLogo = settings?.logo_url || app.logo_url;
  const brandFont = settings?.brand_font || app.brand_font || 'Inter';

  return (
    <div
      className="min-h-screen pb-28 font-sans text-xs transition-colors duration-300"
      style={{ ...themeStyles, backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}
    >
      <header
        className="border-b"
        style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} className="h-9 w-9 rounded-xl object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#4DA3FF]">
                <Layers className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <span className="block truncate text-sm font-black tracking-tight" style={{ fontFamily: brandFont }}>
                {brandName}
              </span>
              {brandSubtitle && <span className="block truncate text-[10px] text-[#9BAEC8]">{brandSubtitle}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AppInstallButton />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition hover:text-white"
              style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }}
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      {carouselImages.length > 0 && (
        <section className="mx-auto mt-4 max-w-4xl px-4">
          <div className="flex snap-x gap-3 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {carouselImages.map((image) => (
              <div
                key={image.id}
                className="relative aspect-[16/9] min-w-[82%] snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#0E223A] sm:min-w-[46%]"
              >
                <img src={image.image_url} alt={image.alt_text || brandName} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      <main className="mx-auto mt-6 max-w-4xl space-y-6 px-4">
        <section
          className="relative flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl border p-6 shadow-xl sm:p-8"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            backgroundImage: app.cover_url
              ? `linear-gradient(to right, rgba(7,26,47,0.92) 38%, rgba(7,26,47,0.25)), url(${app.cover_url})`
              : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: 'var(--app-card)',
          }}
        >
          <div className="z-10 max-w-md space-y-2">
            <span className="rounded bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#4DA3FF]">
              Membro oficial
            </span>
            <h1 className="text-lg font-black leading-tight text-white">Ola, {studentName}!</h1>
            <p className="text-[11px] leading-relaxed text-gray-300">
              {app.description || 'Bem-vindo de volta. Continue assistindo suas aulas de onde parou.'}
            </p>
          </div>

          {totalLessons > 0 && (
            <div className="z-10 mt-6 max-w-sm space-y-2">
              <div className="flex items-center justify-between text-[10px] text-gray-300">
                <span className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-[#4DA3FF]" />
                  Seu progresso
                </span>
                <span className="font-bold text-white">
                  {completedCount}/{totalLessons} ({progressPercent}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-black/40">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%`, backgroundColor: 'var(--app-accent)' }}
                />
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div
            className="flex items-center gap-2 border-b pb-3"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <BookOpen className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#9BAEC8]">Modulos</h2>
            <Link href={`/app/${slug}/modules`} className="ml-auto text-[10px] font-bold text-[#4DA3FF] hover:text-white">
              Ver todos
            </Link>
          </div>

          {modules.length === 0 ? (
            <div
              className="rounded-2xl border py-12 text-center text-[#9BAEC8]"
              style={{ backgroundColor: 'var(--app-card)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              {t('noContent')}
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((moduleItem, moduleIndex) => {
                const releaseState = getModuleReleaseState(moduleItem, access, language, now);
                const isExpanded = expandedModuleId === moduleItem.id && releaseState.isUnlocked;
                const moduleLessons = lessons.filter((lesson) => lesson.module_id === moduleItem.id);
                const completedInModule = moduleLessons.filter((lesson) =>
                  completedLessonIds.includes(lesson.id)
                ).length;

                return (
                  <article
                    key={moduleItem.id}
                    className="overflow-hidden rounded-2xl border transition"
                    style={{
                      backgroundColor: 'var(--app-card)',
                      borderColor: isExpanded ? 'var(--app-primary)' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        releaseState.isUnlocked
                          ? setExpandedModuleId(isExpanded ? null : moduleItem.id)
                          : setExpandedModuleId(null)
                      }
                      className="grid w-full grid-cols-[5.5rem_1fr_auto] items-center gap-3 p-4 text-left hover:bg-white/[0.03]"
                    >
                      <ModuleCover
                        title={moduleItem.name}
                        imageUrl={moduleItem.cover_image_url}
                        altText={moduleItem.cover_alt_text}
                        locked={!releaseState.isUnlocked}
                        className="h-20"
                      />
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] font-bold text-[#9BAEC8]">
                          {(moduleIndex + 1).toString().padStart(2, '0')}
                        </span>
                        <h3 className="truncate text-xs font-black text-white">{moduleItem.name}</h3>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[#9BAEC8]">
                          {moduleItem.description || 'Conteudos deste modulo.'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold ${
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
                          {releaseState.isUnlocked && (
                            <span className="text-[9px] text-[#9BAEC8]">
                              {moduleLessons.length} aulas - {completedInModule} concluidas
                            </span>
                          )}
                        </div>
                      </div>
                      {releaseState.isUnlocked ? (
                        isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-[#9BAEC8]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-[#9BAEC8]" />
                        )
                      ) : (
                        <Lock className="h-4 w-4 text-amber-200" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="divide-y divide-white/10 border-t border-white/10 bg-black/10">
                        {moduleLessons.length === 0 ? (
                          <div className="p-4 text-center text-[11px] text-gray-500">{t('noContent')}</div>
                        ) : (
                          moduleLessons.map((lesson, lessonIndex) => {
                            const isCompleted = completedLessonIds.includes(lesson.id);
                            return (
                              <Link
                                key={lesson.id}
                                href={`/app/${slug}/lessons/${lesson.id}`}
                                className="group flex items-center justify-between gap-4 p-4 transition hover:bg-white/[0.03]"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  {isCompleted ? (
                                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                                  ) : (
                                    <Circle className="h-4 w-4 shrink-0 text-gray-500" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-bold text-white group-hover:text-[#4DA3FF]">
                                      {lessonIndex + 1}. {lesson.title}
                                    </p>
                                    {lesson.description && (
                                      <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-400">
                                        {lesson.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <PlayCircle className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-white" />
                              </Link>
                            );
                          })
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <AppSupportButton settings={settings} />
      <AppBottomNav language={language} />
    </div>
  );
}
