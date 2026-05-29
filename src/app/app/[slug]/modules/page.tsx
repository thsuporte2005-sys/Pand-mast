'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Layers, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AppRecord } from '@/lib/types';

interface ModuleRecord {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
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
  const supabase = createClient();
  const [app, setApp] = useState<AppRecord | null>(null);
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 text-[#1E6BFF] animate-spin" />
        <p className="text-xs text-[#9BAEC8]">Carregando módulos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] pb-12">
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/app/${slug}/home`} className="flex items-center gap-1.5 text-xs text-[#9BAEC8] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Início
          </Link>
          <span className="text-sm font-bold">{app.name}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#0E223A] border border-[#1B3554] text-[#4DA3FF]">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Módulos</h1>
            <p className="text-xs text-[#9BAEC8]">Escolha um módulo para continuar seus estudos.</p>
          </div>
        </div>

        <div className="grid gap-4">
          {modules.map((moduleItem) => {
            const lessonCount = lessons.filter((lesson) => lesson.module_id === moduleItem.id).length;

            return (
              <Link
                key={moduleItem.id}
                href={`/app/${slug}/modules/${moduleItem.id}`}
                className="block rounded-2xl border border-[#1B3554] bg-[#0E223A] p-5 hover:border-[#1E6BFF] transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold">{moduleItem.name}</h2>
                    <p className="text-xs text-[#9BAEC8] mt-1 line-clamp-2">
                      {moduleItem.description || 'Conteúdos disponíveis para este módulo.'}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#4DA3FF] shrink-0">
                    <BookOpen className="h-3.5 w-3.5" />
                    {lessonCount} aulas
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
