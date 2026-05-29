'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, PlayCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AppRecord } from '@/lib/types';

interface ModuleRecord {
  id: string;
  name: string;
  description: string | null;
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
  const supabase = createClient();
  const [app, setApp] = useState<AppRecord | null>(null);
  const [moduleItem, setModuleItem] = useState<ModuleRecord | null>(null);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

        const { data: loadedModule } = await supabase
          .from('app_modules')
          .select('id, name, description')
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
      <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 text-[#1E6BFF] animate-spin" />
        <p className="text-xs text-[#9BAEC8]">Carregando aulas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] pb-12">
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/app/${slug}/modules`} className="flex items-center gap-1.5 text-xs text-[#9BAEC8] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Módulos
          </Link>
          <span className="text-sm font-bold">{app.name}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold">{moduleItem.name}</h1>
          <p className="text-xs text-[#9BAEC8] mt-1">{moduleItem.description || 'Aulas disponíveis neste módulo.'}</p>
        </div>

        <div className="grid gap-3">
          {lessons.map((lesson, index) => (
            <Link
              key={lesson.id}
              href={`/app/${slug}/lessons/${lesson.id}`}
              className="flex items-center gap-4 rounded-2xl border border-[#1B3554] bg-[#0E223A] p-4 hover:border-[#1E6BFF] transition"
            >
              <div className="h-10 w-10 rounded-xl bg-[#0B2A4A] border border-[#1B3554] flex items-center justify-center text-[#4DA3FF] shrink-0">
                <PlayCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-[#9BAEC8]">Aula {index + 1}</p>
                <h2 className="text-sm font-bold truncate">{lesson.title}</h2>
                {lesson.description && (
                  <p className="text-xs text-[#9BAEC8] mt-1 line-clamp-1">{lesson.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
