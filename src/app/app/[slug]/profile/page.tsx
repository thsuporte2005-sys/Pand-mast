'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, LogOut, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AppRecord } from '@/lib/types';

interface ProfileRecord {
  name: string | null;
  email: string;
  status: string;
  created_at: string;
}

export default function AppProfilePage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const supabase = createClient();
  const [app, setApp] = useState<AppRecord | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
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

        const { data: profileData } = await supabase
          .from('final_users')
          .select('name, email, status, created_at')
          .eq('id', user.id)
          .maybeSingle();

        setProfile(
          profileData || {
            name: user.user_metadata?.name || null,
            email: user.email || '',
            status: 'active',
            created_at: user.created_at,
          }
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router, slug, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(`/app/${slug}/login`);
  };

  if (loading || !app || !profile) {
    return (
      <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 text-[#1E6BFF] animate-spin" />
        <p className="text-xs text-[#9BAEC8]">Carregando perfil...</p>
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

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        <div className="rounded-2xl border border-[#1B3554] bg-[#0E223A] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-[#0B2A4A] border border-[#1B3554] flex items-center justify-center text-[#4DA3FF]">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{profile.name || 'Aluno'}</h1>
              <p className="text-xs text-[#9BAEC8]">{profile.email}</p>
            </div>
          </div>

          <div className="grid gap-3 text-xs">
            <div className="flex justify-between border-t border-white/10 pt-3">
              <span className="text-[#9BAEC8]">Status</span>
              <span className="font-semibold text-emerald-400">{profile.status}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3">
              <span className="text-[#9BAEC8]">Membro desde</span>
              <span>{new Date(profile.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1E6BFF] px-4 py-3 text-sm font-semibold hover:bg-[#4DA3FF] transition"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </div>
      </main>
    </div>
  );
}
