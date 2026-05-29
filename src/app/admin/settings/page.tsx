'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  KeyRound, 
  User, 
  ShieldCheck, 
  Loader2, 
  Check, 
  Lock
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';

export default function SettingsPage() {
  const supabase = createClient();
  
  const [adminEmail, setAdminEmail] = useState('');
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAdminUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setAdminEmail(user.email || '');
          setAdminId(user.id);
        }
      } catch (err) {
        console.error('Error fetching admin settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminUser();
  }, [supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      // Log action
      await supabase.from('audit_logs').insert({
        action: 'admin_password_updated',
        details: { user_id: adminId },
      });

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao atualizar a senha.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-gray text-sm">Carregando painel de configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-accent-blue/15 text-light-blue rounded-xl">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-white">Ajustes da Conta</h2>
          <p className="text-xs text-text-gray mt-0.5">Gerencie suas credenciais de acesso administrativas.</p>
        </div>
      </div>

      {/* Account Info Box */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-gray border-b border-border-color/30 pb-3 flex items-center gap-1.5">
          <User className="h-4 w-4 text-light-blue" />
          Perfil Administrativo
        </h3>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between border-b border-border-color/20 pb-2">
            <span className="text-text-gray">E-mail:</span>
            <span className="font-semibold text-text-white">{adminEmail}</span>
          </div>
          <div className="flex justify-between border-b border-border-color/20 pb-2">
            <span className="text-text-gray">Identificador ID:</span>
            <span className="font-mono text-text-white/80">{adminId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-gray">Nível de Permissão:</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" />
              Administrador Geral
            </span>
          </div>
        </div>
      </div>

      {/* Password Reset Form */}
      <form onSubmit={handleUpdatePassword} className="glass-panel p-6 rounded-2xl space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-gray border-b border-border-color/30 pb-3 flex items-center gap-1.5">
          <KeyRound className="h-4 w-4 text-purple-400" />
          Segurança & Alteração de Senha
        </h3>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-4 rounded-xl">
            <p className="font-semibold">Erro ao processar</p>
            <p className="mt-0.5">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs p-4 rounded-xl flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" />
            Senha atualizada com sucesso no Supabase Auth!
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-text-gray mb-1.5">Nova Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-gray/50" />
              <input
                type="password"
                required
                placeholder="Insira a nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-primary-bg border border-border-color text-text-white pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-text-gray mb-1.5">Confirmar Nova Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-gray/50" />
              <input
                type="password"
                required
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-primary-bg border border-border-color text-text-white pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-border-color/30">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent-blue hover:bg-light-blue disabled:bg-accent-blue/50 text-text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando Senha...
              </>
            ) : (
              <>
                Atualizar Senha
              </>
            )}
          </button>
        </div>
      </form>

    </div>
  );
}
