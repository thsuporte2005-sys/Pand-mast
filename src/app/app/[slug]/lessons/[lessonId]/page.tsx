'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  FileText, 
  Loader2, 
  Circle,
  FileCheck,
  Video
} from 'lucide-react';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppSupportButton } from '@/components/app-support-button';
import { getModuleReleaseState, type AccessGrant } from '@/lib/app-experience';
import { createClient } from '@/lib/supabase/client';
import type { AppRecord, AppSettingsRecord, AppTheme } from '@/lib/types';

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_provider: 'youtube' | 'vimeo' | 'wistia' | 'panda' | 'hls' | 'other';
  order_index: number;
  is_published: boolean;
}

interface AppFile {
  id: string;
  name: string;
  url: string;
  file_type: string;
}

export default function LessonPlayPage() {
  const router = useRouter();
  const { slug, lessonId } = useParams() as { slug: string; lessonId: string };
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<AppRecord | null>(null);
  const [settings, setSettings] = useState<AppSettingsRecord | null>(null);
  const [colors, setColors] = useState<AppTheme>({
    primary_color: '#1E6BFF',
    secondary_color: '#0B2A4A',
    accent_color: '#4DA3FF',
    background_color: '#071A2F',
    text_color: '#F5F8FF',
  });

  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [files, setFiles] = useState<AppFile[]>([]);
  
  // Progress & Auth
  const [userId, setUserId] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);

  // Video embed parser helper functions
  const getEmbedUrl = (provider: string, url: string | null) => {
    if (!url) return '';
    
    if (provider === 'youtube') {
      let videoId = '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      } else {
        videoId = url;
      }
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`;
    }
    
    if (provider === 'vimeo') {
      let videoId = '';
      const regExp = /vimeo\.com\/(?:video\/)?([0-9]+)/;
      const match = url.match(regExp);
      if (match && match[1]) {
        videoId = match[1];
      } else {
        videoId = url;
      }
      return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    }
    
    if (provider === 'wistia') {
      let videoId = '';
      const regExp = /(?:wistia\.com|wistia\.net)\/(?:medias|embed\/iframe)\/([a-zA-Z0-9]+)/;
      const match = url.match(regExp);
      if (match && match[1]) {
        videoId = match[1];
      } else {
        videoId = url;
      }
      return `https://fast.wistia.net/embed/iframe/${videoId}`;
    }

    if (provider === 'panda') {
      // Panda Video URLs are embed links directly, return as is
      return url;
    }

    return url;
  };

  useEffect(() => {
    async function loadLessonData() {
      try {
        setLoading(true);

        // 1. Fetch App metadata
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

        // 2. Auth & Progress Check
        let effectiveAccessForRequest: AccessGrant | null = null;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);

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

          const effectiveAccess = adminCheck
            ? { status: 'active', access_granted_at: '2000-01-01T00:00:00.000Z' }
            : accessData;
          effectiveAccessForRequest = effectiveAccess;

          if (!adminCheck && (!accessData || accessData.status !== 'active')) {
            router.push(`/app/${slug}/login?error=no-access`);
            return;
          }

          const localProgress = localStorage.getItem(`progress_${user.id}_${appData.id}`);
          if (localProgress) {
            setCompletedLessonIds(JSON.parse(localProgress));
          }
        } else {
          router.push(`/app/${slug}/login`);
          return;
        }

        // 3. Fetch App settings
        const { data: colorsData } = await supabase
          .from('app_settings')
          .select('*')
          .eq('app_id', appData.id)
          .maybeSingle();

        if (colorsData) {
          setSettings(colorsData);
          setColors({
            primary_color: colorsData.primary_color,
            secondary_color: colorsData.secondary_color,
            accent_color: colorsData.accent_color,
            background_color: colorsData.background_color,
            text_color: colorsData.text_color,
          });
        }

        // 4. Fetch Current Lesson details
        const { data: lessonData } = await supabase
          .from('app_lessons')
          .select('*')
          .eq('id', lessonId)
          .single();

        if (lessonData) {
          const { data: moduleData } = await supabase
            .from('app_modules')
            .select('id, release_type, release_after_days, is_scheduled_release')
            .eq('id', lessonData.module_id)
            .maybeSingle();

          if (moduleData) {
            const releaseState = getModuleReleaseState(
              moduleData,
              effectiveAccessForRequest,
              appData.default_language || 'pt-BR'
            );

            if (!releaseState.isUnlocked) {
              router.push(`/app/${slug}/modules/${lessonData.module_id}`);
              return;
            }
          }

          setCurrentLesson(lessonData);

          // Fetch all published lessons in this module to build Prev/Next
          const { data: relativeLessons } = await supabase
            .from('app_lessons')
            .select('*')
            .eq('module_id', lessonData.module_id)
            .eq('is_published', true)
            .order('order_index', { ascending: true });

          setAllLessons(relativeLessons || []);
        } else {
          router.push(`/app/${slug}/modules`);
          return;
        }

        // 5. Fetch attachments/files
        const { data: fileData } = await supabase
          .from('app_files')
          .select('*')
          .eq('lesson_id', lessonId);

        setFiles(fileData || []);

      } catch (err) {
        console.error('Error loading lesson player page:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLessonData();
  }, [slug, lessonId, router, supabase]);

  const toggleComplete = () => {
    if (!userId || !app || !currentLesson) return;

    let updated: string[];
    const isCompleted = completedLessonIds.includes(currentLesson.id);

    if (isCompleted) {
      updated = completedLessonIds.filter(id => id !== currentLesson.id);
    } else {
      updated = [...completedLessonIds, currentLesson.id];
    }

    setCompletedLessonIds(updated);
    localStorage.setItem(`progress_${userId}_${app.id}`, JSON.stringify(updated));
  };

  // Prev / Next Lesson Navigation
  const currentIdx = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  if (loading || !currentLesson || !app) {
    return (
      <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 text-[#1E6BFF] animate-spin" />
        <p className="text-xs text-[#9BAEC8]">Carregando aula...</p>
      </div>
    );
  }

  // Inject colors in layout
  const themeStyles = {
    '--app-bg': colors.background_color,
    '--app-card': colors.secondary_color,
    '--app-primary': colors.primary_color,
    '--app-accent': colors.accent_color,
    '--app-text': colors.text_color,
  } as React.CSSProperties;

  const isCompleted = completedLessonIds.includes(currentLesson.id);
  const embedUrl = getEmbedUrl(currentLesson.video_provider, currentLesson.video_url);

  return (
    <div 
      className="min-h-screen pb-28 transition-colors duration-300 font-sans text-xs flex flex-col"
      style={{ ...themeStyles, backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}
    >
      
      {/* Header */}
      <header className="border-b" style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            href={`/app/${slug}/home`}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-opacity-80 hover:text-white transition"
            style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Grade de Aulas
          </Link>
          
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight">{app.name}</span>
          </div>
        </div>
      </header>

      {/* Main content grid */}
      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6 w-full flex-1">
        
        {/* Video Player Section */}
        <div className="rounded-2xl overflow-hidden bg-black aspect-video relative shadow-xl border border-white/5">
          {currentLesson.video_url ? (
            ['youtube', 'vimeo', 'wistia', 'panda'].includes(currentLesson.video_provider) ? (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                frameBorder="0"
              />
            ) : (
              // HLS or general MP4 link fallback
              <video
                src={currentLesson.video_url}
                className="w-full h-full"
                controls
                autoPlay
              />
            )
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2.5 text-gray-500">
              <Video className="h-10 w-10 text-gray-600" />
              <span>Esta aula não possui vídeo. Leia o material abaixo.</span>
            </div>
          )}
        </div>

        {/* Title and Completion Button Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white leading-snug">{currentLesson.title}</h2>
            <p className="text-[10px] text-gray-400">Aula {currentIdx + 1} de {allLessons.length}</p>
          </div>

          <button
            onClick={toggleComplete}
            className="self-start sm:self-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition text-xs border cursor-pointer"
            style={{ 
              backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'var(--app-primary)',
              borderColor: isCompleted ? '#10b981' : 'transparent',
              color: isCompleted ? '#34d399' : 'white'
            }}
          >
            {isCompleted ? (
              <>
                <CheckCircle className="h-4.5 w-4.5" />
                Aula Concluída
              </>
            ) : (
              <>
                <Circle className="h-4.5 w-4.5" />
                Marcar como Concluída
              </>
            )}
          </button>
        </div>

        {/* Description & Materials split */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Description (Left) */}
          <div className="md:col-span-8 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-opacity-70 text-[#9BAEC8]">Descrição da Aula</h3>
            <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-line">
              {currentLesson.description || 'Nenhum resumo disponível para esta aula.'}
            </p>
          </div>

          {/* Materials Support (Right) */}
          <div className="md:col-span-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-opacity-70 text-[#9BAEC8] flex items-center gap-1.5">
              <FileCheck className="h-4 w-4 text-[#4DA3FF]" />
              Materiais ({files.length})
            </h3>
            
            {files.length === 0 ? (
              <div className="text-center py-6 text-gray-500 rounded-xl border text-[10px]" style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.08)' }}>
                Sem downloads para esta aula.
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-xl border hover:bg-white/2 transition"
                    style={{ backgroundColor: 'var(--app-card)', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-[#4DA3FF] shrink-0" />
                      <span className="font-semibold text-white truncate text-[10px]">{file.name}</span>
                    </div>
                    <Download className="h-3.5 w-3.5 text-gray-400 hover:text-white shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* bottom navigation panel */}
        <div className="flex items-center justify-between border-t pt-6 mt-8" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {prevLesson ? (
            <button
              onClick={() => router.push(`/app/${slug}/lessons/${prevLesson.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-xl hover:bg-white/2 transition font-bold"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <ChevronLeft className="h-4 w-4" />
              Aula Anterior
            </button>
          ) : (
            <div />
          )}

          {nextLesson ? (
            <button
              onClick={() => router.push(`/app/${slug}/lessons/${nextLesson.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-xl hover:bg-white/2 transition font-bold"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              Próxima Aula
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div />
          )}
        </div>

      </main>

      <AppSupportButton settings={settings} />
      <AppBottomNav language={app.default_language || 'pt-BR'} />

    </div>
  );
}
