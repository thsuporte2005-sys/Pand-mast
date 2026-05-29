'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldAlert, Loader2 } from 'lucide-react';

export default function AppEntryPage() {
  const router = useRouter();
  const { slug } = useParams() as { slug: string };
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'not_found' | 'no_access' | 'blocked' | 'checking'>('checking');

  useEffect(() => {
    async function checkAccess() {
      try {
        setLoading(true);
        
        // 1. Fetch App details
        const { data: appData, error: appErr } = await supabase
          .from('apps')
          .select('*')
          .eq('slug', slug)
          .single();

        if (appErr || !appData) {
          setStatus('not_found');
          setLoading(false);
          return;
        }

        // If app is draft, check if current user is an admin
        const { data: { user } } = await supabase.auth.getUser();
        
        if (appData.status === 'draft') {
          if (!user) {
            router.push(`/app/${slug}/login`);
            return;
          }

          const { data: adminCheck } = await supabase
            .from('admins')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (!adminCheck) {
            setStatus('no_access');
            setLoading(false);
            return;
          }
        }

        // 2. Check Auth user
        if (!user) {
          router.push(`/app/${slug}/login`);
          return;
        }

        // 3. Check App Access
        const { data: accessData, error: accessErr } = await supabase
          .from('user_app_access')
          .select('status')
          .eq('user_id', user.id)
          .eq('app_id', appData.id)
          .maybeSingle();

        // Admin override: check if the user is an admin, admins can view any app
        const { data: adminOverride } = await supabase
          .from('admins')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (adminOverride) {
          router.push(`/app/${slug}/home`);
          return;
        }

        if (accessErr || !accessData) {
          setStatus('no_access');
          setLoading(false);
          return;
        }

        if (accessData.status === 'blocked') {
          setStatus('blocked');
          setLoading(false);
          return;
        }

        if (accessData.status === 'expired') {
          setStatus('no_access');
          setLoading(false);
          return;
        }

        // Active access: redirect to home
        router.push(`/app/${slug}/home`);
      } catch (err) {
        console.error('Entry page error:', err);
        setStatus('no_access');
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [slug, router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(`/app/${slug}/login`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 text-[#1E6BFF] animate-spin" />
        <p className="text-xs text-[#9BAEC8]">Verificando acesso seguro...</p>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <ShieldAlert className="h-14 w-14 text-red-500" />
        <h2 className="text-xl font-bold">Aplicativo Não Encontrado</h2>
        <p className="text-sm text-[#9BAEC8] max-w-sm">O endereço que você tentou acessar não existe ou foi removido pelo administrador.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] flex flex-col items-center justify-center p-6 text-center">
      
      <div className="max-w-md w-full bg-[#0E223A] border border-[#1B3554] p-8 rounded-2xl shadow-2xl space-y-6">
        <ShieldAlert className="h-14 w-14 text-amber-500 mx-auto" />
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Acesso Restrito</h2>
          <p className="text-xs text-[#9BAEC8] leading-relaxed">
            {status === 'blocked' 
              ? 'O seu acesso a este aplicativo foi bloqueado temporariamente. Entre em contato com o suporte do produtor para mais informações.'
              : 'Você não possui uma licença ativa para acessar este treinamento. Verifique o e-mail de compra ou realize a aquisição do produto.'
            }
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-4">
          <button
            onClick={handleSignOut}
            className="w-full bg-[#1E6BFF] hover:bg-[#4DA3FF] text-[#F5F8FF] py-3 rounded-xl text-xs font-semibold transition"
          >
            Entrar com Outra Conta
          </button>
          
          <button
            onClick={() => router.push(`/app/${slug}/login`)}
            className="w-full bg-transparent hover:bg-white/5 border border-[#1B3554] text-[#9BAEC8] py-2 rounded-xl text-xs transition"
          >
            Voltar para o Login
          </button>
        </div>
      </div>

    </div>
  );
}
