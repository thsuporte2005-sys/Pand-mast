'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Mail, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.user) {
        const { data: adminCheck, error: checkError } = await supabase
          .from('admins')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (checkError) {
          throw new Error('Erro ao verificar permissões de administrador.');
        }

        if (!adminCheck) {
          await supabase.auth.signOut();
          throw new Error('Esta conta não possui privilégios de administrador. Cadastre o UID em public.admins pelo Supabase.');
        }

        // Successfully logged in as admin
        router.push('/admin/dashboard');
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient light effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-blue/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-light-blue/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="w-full max-w-md z-10">
        
        {/* Brand logo & header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 bg-secondary-bg border border-border-color rounded-2xl mb-4 shadow-xl shadow-black/30">
            <img src="/pngs/loggo.png" alt="Pand mast" className="h-12 w-auto object-contain" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-text-white">Pand mast</h2>
          <p className="text-text-gray text-sm mt-2">Painel Administrativo Privado</p>
        </div>

        {/* Card */}
        <div className="bg-card-bg/60 backdrop-blur-xl border border-border-color/85 p-8 rounded-2xl shadow-2xl shadow-black/40">
          
          {errorMessage && (
            <div className="flex gap-2.5 items-start bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-4 rounded-xl mb-6">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro de Acesso</p>
                <p className="text-xs text-red-400/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {infoMessage && (
            <div className="flex gap-2.5 items-start bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm p-4 rounded-xl mb-6">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 rotate-180 text-emerald-400" />
              <div>
                <p className="font-semibold">Configuração</p>
                <p className="text-xs text-emerald-400/90 mt-0.5">{infoMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-gray/80" />
                <input
                  type="email"
                  required
                  placeholder="admin@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white placeholder-text-gray/50 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all duration-200 text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-text-gray uppercase tracking-wider">
                  Senha
                </label>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-gray/80" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white placeholder-text-gray/50 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all duration-200 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-blue hover:bg-light-blue disabled:bg-accent-blue/50 text-text-white py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-accent-blue/15 hover:shadow-light-blue/10 transition-all duration-200 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  Entrar no Painel
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-text-gray/70 mt-8">
          Pand mast &copy; {new Date().getFullYear()} — Acesso Restrito
        </p>

      </div>
    </div>
  );
}
