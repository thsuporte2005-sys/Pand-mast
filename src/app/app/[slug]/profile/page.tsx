'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Camera, CheckCircle, Loader2, LogOut, Save, User } from 'lucide-react';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppSupportButton } from '@/components/app-support-button';
import {
  getFixedText,
  sanitizeStorageFileName,
  validatePublicImage,
} from '@/lib/app-experience';
import { getErrorMessage } from '@/lib/errors';
import { PUBLIC_MEDIA_BUCKET } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import type { AppRecord, AppSettingsRecord } from '@/lib/types';

interface ProfileRecord {
  name: string | null;
  email: string;
  status: string;
  avatar_url: string | null;
  avatar_path: string | null;
  created_at: string;
}

interface AccessRecord {
  id: string;
  status: string;
  app_id: string;
  access_granted_at: string | null;
  granted_at: string | null;
  apps: {
    name: string;
    slug: string;
  } | null;
}

export default function AppProfilePage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [app, setApp] = useState<AppRecord | null>(null);
  const [settings, setSettings] = useState<AppSettingsRecord | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [accesses, setAccesses] = useState<AccessRecord[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('*')
          .eq('app_id', appData.id)
          .maybeSingle();

        setSettings(settingsData);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push(`/app/${slug}/login`);
          return;
        }

        setUserId(user.id);

        const { data: profileData } = await supabase
          .from('final_users')
          .select('name, email, status, avatar_url, avatar_path, created_at')
          .eq('id', user.id)
          .maybeSingle();

        const fallbackProfile = {
          name: user.user_metadata?.name || null,
          email: user.email || '',
          status: 'active',
          avatar_url: null,
          avatar_path: null,
          created_at: user.created_at,
        };

        const loadedProfile = profileData || fallbackProfile;
        setProfile(loadedProfile);
        setName(loadedProfile.name || '');
        setAvatarUrl(loadedProfile.avatar_url);
        setAvatarPath(loadedProfile.avatar_path);

        const { data: accessData } = await supabase
          .from('user_app_access')
          .select('id, status, app_id, access_granted_at, granted_at, apps(name, slug)')
          .eq('user_id', user.id)
          .order('granted_at', { ascending: false });

        const normalizedAccesses = (accessData || []).map((access) => ({
          ...access,
          apps: Array.isArray(access.apps) ? access.apps[0] || null : access.apps,
        }));

        setAccesses(normalizedAccesses as AccessRecord[]);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router, slug, supabase]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    const validationError = validatePublicImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const path = `avatars/${userId}/${sanitizeStorageFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      setAvatarPath(path);
      setMessage('Foto carregada. Clique em salvar alteracoes para gravar.');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('final_users')
        .update({
          name: name.trim() || null,
          avatar_url: avatarUrl,
          avatar_path: avatarPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setProfile((current) =>
        current
          ? {
              ...current,
              name: name.trim() || null,
              avatar_url: avatarUrl,
              avatar_path: avatarPath,
            }
          : current
      );
      setMessage('Perfil atualizado com sucesso.');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(`/app/${slug}/login`);
  };

  if (loading || !app || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#071A2F] text-[#F5F8FF]">
        <Loader2 className="h-10 w-10 animate-spin text-[#1E6BFF]" />
        <p className="text-xs text-[#9BAEC8]">Carregando perfil...</p>
      </div>
    );
  }

  const language = app.default_language || 'pt-BR';
  const brandName = settings?.display_name || app.display_name || app.name;
  const t = (key: string) => getFixedText(language, key);

  return (
    <div className="min-h-screen bg-[#071A2F] pb-28 text-[#F5F8FF]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href={`/app/${slug}/home`} className="flex items-center gap-1.5 text-xs text-[#9BAEC8] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Inicio
          </Link>
          <span className="truncate text-sm font-bold">{brandName}</span>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-2xl space-y-5 px-4">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#1B3554] bg-[#0E223A] p-6">
          <div className="flex items-center gap-4">
            <label className="group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-[#1B3554] bg-[#0B2A4A] text-[#4DA3FF]">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile.name || 'Perfil'} className="h-full w-full object-cover" />
              ) : (
                <User className="h-7 w-7" />
              )}
              <span className="absolute inset-0 hidden items-center justify-center bg-black/45 text-white group-hover:flex">
                <Camera className="h-5 w-5" />
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{t('myProfile')}</h1>
              <p className="truncate text-xs text-[#9BAEC8]">{profile.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="space-y-1.5 text-xs">
              <span className="font-semibold text-[#9BAEC8]">{t('name')}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-[#1B3554] bg-[#071A2F] px-3.5 py-3 text-[#F5F8FF] outline-none transition focus:border-[#1E6BFF]"
                placeholder="Seu nome"
              />
            </label>

            <label className="space-y-1.5 text-xs">
              <span className="font-semibold text-[#9BAEC8]">{t('email')}</span>
              <input
                value={profile.email}
                readOnly
                className="w-full rounded-xl border border-[#1B3554] bg-[#071A2F]/70 px-3.5 py-3 text-[#9BAEC8] outline-none"
              />
            </label>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E6BFF] px-4 py-3 text-sm font-semibold transition hover:bg-[#4DA3FF] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('saveChanges')}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1B3554] bg-[#0B2A4A] px-4 py-3 text-sm font-semibold transition hover:bg-[#14365d]"
            >
              <LogOut className="h-4 w-4" />
              {t('logout')}
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-[#1B3554] bg-[#0E223A] p-5">
          <h2 className="text-sm font-bold">Apps liberados</h2>
          <div className="mt-4 space-y-3">
            {accesses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#1B3554] p-5 text-center text-xs text-[#9BAEC8]">
                Nenhum acesso encontrado.
              </div>
            ) : (
              accesses.map((access) => {
                const grantedAt = access.access_granted_at || access.granted_at;

                return (
                  <div key={access.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#1B3554] bg-[#071A2F]/60 p-3 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{access.apps?.name || access.app_id}</p>
                      <p className="text-[10px] text-[#9BAEC8]">
                        Liberado em {grantedAt ? new Date(grantedAt).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
                        access.status === 'active'
                          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                          : 'border-red-400/20 bg-red-400/10 text-red-200'
                      }`}
                    >
                      <CheckCircle className="h-3 w-3" />
                      {access.status === 'active' ? t('accessActive') : t('accessBlocked')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      <AppSupportButton settings={settings} />
      <AppBottomNav language={language} />
    </div>
  );
}
