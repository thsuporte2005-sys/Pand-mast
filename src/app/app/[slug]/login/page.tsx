'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mail, KeyRound, ArrowRight, Loader2, AlertTriangle, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import type { AppRecord, AppTheme } from '@/lib/types';

export default function AppLoginPage() {
  const router = useRouter();
  const { slug } = useParams() as { slug: string };
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [app, setApp] = useState<AppRecord | null>(null);
  const [colors, setColors] = useState<AppTheme>({
    primary_color: '#1E6BFF',
    secondary_color: '#0B2A4A',
    accent_color: '#4DA3FF',
    background_color: '#071A2F',
    text_color: '#F5F8FF',
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAppBranding() {
      try {
        setLoading(true);
        // Load App metadata
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

        // Load colors
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
      } catch (err) {
        console.error('Error loading login branding:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAppBranding();
  }, [slug, router, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMessage(null);

    try {
      if (!app) {
        throw new Error('Aplicativo não carregado.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.user) {
        // Double check access
        const { data: accessData } = await supabase
          .from('user_app_access')
          .select('status')
          .eq('user_id', data.user.id)
          .eq('app_id', app.id)
          .maybeSingle();

        const { data: adminCheck } = await supabase
          .from('admins')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        // Allow access if they are admin or have active status
        if (adminCheck || (accessData && accessData.status === 'active')) {
          router.push(`/app/${slug}/home`);
          router.refresh();
        } else {
          await supabase.auth.signOut();
          throw new Error('Você não possui autorização ou seu acesso foi bloqueado para este aplicativo.');
        }
      }
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, 'Falha na autenticação.'));
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071A2F] text-[#F5F8FF] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 text-[#1E6BFF] animate-spin" />
        <p className="text-xs text-[#9BAEC8]">Estruturando portal...</p>
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

  return (
    <div 
      className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden transition-colors duration-300"
      style={{ ...themeStyles, backgroundColor: 'var(--app-bg)' }}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 w-96 h-96 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 opacity-15 pointer-events-none" style={{ backgroundColor: 'var(--app-primary)' }} />

      <div className="w-full max-w-md z-10 space-y-6">
        
        {/* Brand header */}
        <div className="text-center space-y-4">
          <div 
            className="inline-flex items-center justify-center p-3.5 border rounded-2xl shadow-xl transition-all"
            style={{ backgroundColor: 'var(--app-card)', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {app?.logo_url ? (
              <img src={app.logo_url} alt={app.name} className="h-14 w-auto object-contain" />
            ) : (
              <Layers className="h-10 w-10" style={{ color: 'var(--app-accent)' }} />
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>{app?.name}</h2>
            <p className="text-xs text-opacity-70 text-[#9BAEC8]">Faça login para acessar o conteúdo exclusivo</p>
          </div>
        </div>

        {/* Login Form Box */}
        <div 
          className="border p-8 rounded-2xl shadow-2xl backdrop-blur-md"
          style={{ backgroundColor: 'rgba(15, 35, 60, 0.4)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {errorMessage && (
            <div className="flex gap-2.5 items-start bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] p-3.5 rounded-xl mb-6">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5 text-xs">
            <div>
              <label className="block font-semibold text-opacity-75 uppercase tracking-wider mb-2 text-[#9BAEC8]">
                E-mail de Cadastro
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9BAEC8]" />
                <input
                  type="email"
                  required
                  placeholder="aluno@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/35 border text-white placeholder-text-gray/50 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:ring-1 transition-all"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-opacity-75 uppercase tracking-wider mb-2 text-[#9BAEC8]">
                Senha de Acesso
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9BAEC8]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/35 border text-white placeholder-text-gray/50 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:ring-1 transition-all"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-1.5 shadow-lg transition-all"
              style={{ backgroundColor: 'var(--app-primary)' }}
            >
              {authLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando credenciais...
                </>
              ) : (
                <>
                  Acessar Área de Membros
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-[#9BAEC8] text-opacity-50">
          Acesso privado. Para suporte sobre sua compra, consulte o e-mail cadastrado.
        </p>

      </div>
    </div>
  );
}
