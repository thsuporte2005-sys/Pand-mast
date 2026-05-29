'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Layers, 
  PlayCircle, 
  CheckCircle, 
  LogOut, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  Award,
  Circle,
  Loader2,
  User
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AppInstallButton } from '@/components/app-install-button';
import type { AppRecord, AppTheme } from '@/lib/types';

interface Module {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
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

export default function AppHomePage() {
  const router = useRouter();
  const { slug } = useParams() as { slug: string };
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<AppRecord | null>(null);
  const [colors, setColors] = useState<AppTheme>({
    primary_color: '#1E6BFF',
    secondary_color: '#0B2A4A',
    accent_color: '#4DA3FF',
    background_color: '#071A2F',
    text_color: '#F5F8FF',
  });

  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  
  // Progress state
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [studentName, setStudentName] = useState('Aluno');

  useEffect(() => {
    async function loadAppData() {
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

        // 2. Fetch User name
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check access or admin override
          const { data: accessData } = await supabase
            .from('user_app_access')
            .select('status')
            .eq('user_id', user.id)
            .eq('app_id', appData.id)
            .maybeSingle();

          const { data: adminCheck } = await supabase
            .from('admins')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (!adminCheck && (!accessData || accessData.status !== 'active')) {
            router.push(`/app/${slug}`);
            return;
          }

          // Fetch profile details
          const { data: profile } = await supabase
            .from('final_users')
            .select('name')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.name) {
            setStudentName(profile.name);
          } else if (user.email) {
            setStudentName(user.email.split('@')[0]);
          }

          // Load completed lesson progress from localStorage
          const localProgress = localStorage.getItem(`progress_${user.id}_${appData.id}`);
          if (localProgress) {
            try {
              setCompletedLessonIds(JSON.parse(localProgress));
            } catch (e) {
              console.error(e);
            }
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
          setColors({
            primary_color: colorsData.primary_color,
            secondary_color: colorsData.secondary_color,
            accent_color: colorsData.accent_color,
            background_color: colorsData.background_color,
            text_color: colorsData.text_color,
          });
        }

        // 4. Fetch Modules & Lessons
        const { data: modulesData } = await supabase
          .from('app_modules')
          .select('*')
          .eq('app_id', appData.id)
          .order('order_index', { ascending: true });

        const mods = modulesData || [];
        setModules(mods);

        if (mods.length > 0) {
          setExpandedModuleId(mods[0].id);

          const modIds = mods.map(m => m.id);
          const { data: lessonsData } = await supabase
            .from('app_lessons')
            .select('*')
            .in('module_id', modIds)
            .eq('is_published', true)
            .order('order_index', { ascending: true });

          setLessons(lessonsData || []);
        }

      } catch (err) {
        console.error('Error loading app home:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAppData();
  }, [slug, router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(`/app/${slug}/login`);
  };

  const toggleExpandModule = (moduleId: string) => {
    if (expandedModuleId === moduleId) {
      setExpandedModuleId(null);
    } else {
      setExpandedModuleId(moduleId);
    }
  };

  if (loading || !app) {
    return (
      <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 text-[#1E6BFF] animate-spin" />
        <p className="text-xs text-[#9BAEC8]">Montando painel de aulas...</p>
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

  // Calculate progress
  const totalLessons = lessons.length;
  const completedCount = lessons.filter(l => completedLessonIds.includes(l.id)).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div 
      className="min-h-screen pb-12 transition-colors duration-300 font-sans text-xs"
      style={{ ...themeStyles, backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}
    >
      
      {/* Header */}
      <header className="border-b" style={{ backgroundColor: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {app.logo_url ? (
              <img src={app.logo_url} alt={app.name} className="h-8 w-auto object-contain" />
            ) : (
              <Layers className="h-6 w-6" style={{ color: 'var(--app-accent)' }} />
            )}
            <span className="font-bold text-sm tracking-tight">{app.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/app/${slug}/profile`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-opacity-80 hover:text-white transition"
              style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }}
            >
              <User className="h-3.5 w-3.5" />
              Perfil
            </Link>
            <AppInstallButton />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-opacity-80 hover:text-white transition"
              style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Welcome Banner */}
        <div 
          className="relative rounded-2xl overflow-hidden p-6 sm:p-8 flex flex-col justify-between min-h-[160px] border shadow-xl"
          style={{ 
            borderColor: 'rgba(255,255,255,0.08)',
            backgroundImage: app.cover_url ? `linear-gradient(to right, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.1)), url(${app.cover_url})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: 'var(--app-card)'
          }}
        >
          <div className="space-y-1.5 max-w-md z-10">
            <span className="bg-white/10 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-[#4DA3FF]">Membro Oficial</span>
            <h2 className="text-lg font-bold text-white leading-tight">Olá, {studentName}!</h2>
            <p className="text-[11px] text-gray-300 leading-normal">
              {app.description || 'Bem-vindo de volta! Continue assistindo suas aulas de onde parou.'}
            </p>
          </div>

          {/* Progress Tracker Bar */}
          {totalLessons > 0 && (
            <div className="mt-6 z-10 space-y-2 max-w-sm">
              <div className="flex items-center justify-between text-[10px] text-gray-300">
                <span className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-[#4DA3FF]" />
                  Seu Progresso
                </span>
                <span className="font-bold text-white">{completedCount}/{totalLessons} ({progressPercent}%)</span>
              </div>
              <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%`, backgroundColor: 'var(--app-accent)' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modules List Heading */}
        <div className="flex items-center gap-2 border-b pb-3 mb-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <BookOpen className="h-4.5 w-4.5" style={{ color: 'var(--app-accent)' }} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-opacity-70 text-[#9BAEC8]">Módulos Disponíveis</h3>
          <Link href={`/app/${slug}/modules`} className="ml-auto text-[10px] font-bold text-[#4DA3FF] hover:text-white">
            Ver todos
          </Link>
        </div>

        {/* Modules Accordion */}
        {modules.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border" style={{ backgroundColor: 'var(--app-card)', borderColor: 'rgba(255,255,255,0.08)' }}>
            Nenhum conteúdo publicado neste aplicativo ainda.
          </div>
        ) : (
          <div className="space-y-4">
            {modules.map((mod, modIdx) => {
              const isExpanded = expandedModuleId === mod.id;
              const moduleLessons = lessons.filter(l => l.module_id === mod.id);
              const completedInModule = moduleLessons.filter(l => completedLessonIds.includes(l.id)).length;
              
              return (
                <div 
                  key={mod.id} 
                  className="rounded-2xl border overflow-hidden transition-all duration-300"
                  style={{ 
                    backgroundColor: 'var(--app-card)', 
                    borderColor: isExpanded ? 'var(--app-primary)' : 'rgba(255,255,255,0.08)' 
                  }}
                >
                  
                  {/* Module Accordion Header */}
                  <div 
                    onClick={() => toggleExpandModule(mod.id)}
                    className="p-5 flex items-center justify-between cursor-pointer select-none hover:bg-white/2"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border border-white/5 font-bold font-mono text-white" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {(modIdx + 1).toString().padStart(2, '0')}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white truncate text-xs">{mod.name}</h4>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate leading-relaxed">
                          {moduleLessons.length} aulas • {completedInModule} concluídas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronUp className="h-4.5 w-4.5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4.5 w-4.5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Module Lessons List */}
                  {isExpanded && (
                    <div className="border-t divide-y" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                      {moduleLessons.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-gray-500">Nenhuma aula neste módulo.</div>
                      ) : (
                        moduleLessons.map((les, lesIdx) => {
                          const isCompleted = completedLessonIds.includes(les.id);
                          return (
                            <Link 
                              key={les.id}
                              href={`/app/${slug}/lessons/${les.id}`}
                              className="flex items-center justify-between p-4.5 hover:bg-white/2 transition-all duration-200 group"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                {/* Completion Check Icon */}
                                <div className="shrink-0">
                                  {isCompleted ? (
                                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400 fill-emerald-400/10" />
                                  ) : (
                                    <Circle className="h-4.5 w-4.5 text-gray-500 hover:text-white" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="font-semibold text-white group-hover:text-[#4DA3FF] transition text-xs truncate">
                                    {lesIdx + 1}. {les.title}
                                  </p>
                                  {les.description && (
                                    <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{les.description}</p>
                                  )}
                                </div>
                              </div>

                              <PlayCircle className="h-5 w-5 text-gray-400 group-hover:text-white shrink-0 transition" />
                            </Link>
                          );
                        })
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

      </main>

    </div>
  );
}
