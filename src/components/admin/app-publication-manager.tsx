'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft, Edit3, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { LANGUAGE_OPTIONS } from '@/lib/app-experience';
import { getErrorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

type PublicationKind = 'community' | 'notices';

interface PublicationRecord {
  id: string;
  title: string;
  content: string | null;
  language_code: string;
  image_url?: string | null;
  is_published: boolean;
  created_at: string;
}

const publicationSchema = z.object({
  title: z.string().min(2, 'Informe o titulo.'),
  content: z.string().optional(),
  languageCode: z.enum(['pt-BR', 'en-US', 'es-ES', 'fr-FR']),
  imageUrl: z.string().url('URL da imagem invalida.').optional().or(z.literal('')),
  isPublished: z.boolean(),
});

const config = {
  community: {
    table: 'app_posts',
    title: 'Comunidade',
    description: 'Crie publicacoes exibidas na comunidade do app final.',
    empty: 'Nenhuma publicacao criada.',
    action: 'app_post_saved',
    image: true,
  },
  notices: {
    table: 'app_notices',
    title: 'Avisos',
    description: 'Crie avisos oficiais exibidos em ordem recente no app final.',
    empty: 'Nenhum aviso criado.',
    action: 'app_notice_saved',
    image: false,
  },
} as const;

export function AppPublicationManager({ kind }: { kind: PublicationKind }) {
  const { id: appId } = useParams() as { id: string };
  const supabase = useMemo(() => createClient(), []);
  const page = config[kind];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PublicationRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [languageCode, setLanguageCode] = useState<'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR'>('pt-BR');
  const [imageUrl, setImageUrl] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRows() {
      const { data } = await supabase
        .from(page.table)
        .select('*')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });

      setRows((data || []) as PublicationRecord[]);
      setLoading(false);
    }

    loadRows();
  }, [appId, page.table, supabase]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setLanguageCode('pt-BR');
    setImageUrl('');
    setIsPublished(true);
  };

  const startEdit = (row: PublicationRecord) => {
    setEditingId(row.id);
    setTitle(row.title);
    setContent(row.content || '');
    setLanguageCode(row.language_code as 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR');
    setImageUrl(row.image_url || '');
    setIsPublished(row.is_published);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const parsed = publicationSchema.parse({
        title,
        content,
        languageCode,
        imageUrl,
        isPublished,
      });

      const payload = {
        app_id: appId,
        title: parsed.title.trim(),
        content: parsed.content?.trim() || null,
        language_code: parsed.languageCode,
        is_published: parsed.isPublished,
        ...(page.image ? { image_url: parsed.imageUrl || null } : {}),
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from(page.table)
          .update(payload)
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from(page.table).insert(payload);
        if (insertError) throw insertError;
      }

      await supabase.from('audit_logs').insert({
        action: page.action,
        details: { app_id: appId, id: editingId, kind },
      });

      const { data } = await supabase
        .from(page.table)
        .select('*')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });

      setRows((data || []) as PublicationRecord[]);
      resetForm();
      setMessage('Conteudo salvo.');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (rowId: string) => {
    if (!confirm('Excluir este item?')) return;

    const { error: deleteError } = await supabase.from(page.table).delete().eq('id', rowId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-accent-blue" />
        <p className="text-sm text-text-gray">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/apps/${appId}/settings`} className="rounded-xl border border-border-color bg-card-bg p-2 text-text-gray hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-text-white">{page.title}</h2>
          <p className="text-sm text-text-gray">{page.description}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border-color bg-secondary-bg p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs sm:col-span-2">
            <span className="font-semibold text-text-gray">Titulo</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
          </label>
          <label className="space-y-1.5 text-xs">
            <span className="font-semibold text-text-gray">Idioma</span>
            <select value={languageCode} onChange={(event) => setLanguageCode(event.target.value as 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR')} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue">
              {LANGUAGE_OPTIONS.map((language) => (
                <option key={language.code} value={language.code}>{language.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-xs text-text-white">
            <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
            Publicado
          </label>
          {page.image && (
            <label className="space-y-1.5 text-xs sm:col-span-2">
              <span className="font-semibold text-text-gray">URL da imagem</span>
              <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
            </label>
          )}
          <label className="space-y-1.5 text-xs sm:col-span-2">
            <span className="font-semibold text-text-gray">Conteudo</span>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
          </label>
        </div>

        {message && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{message}</p>}
        {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-5 py-3 text-sm font-bold text-white hover:bg-light-blue disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Salvar item' : 'Criar item'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-xl border border-border-color bg-card-bg px-5 py-3 text-sm font-bold text-text-white hover:bg-border-color">
              Cancelar edicao
            </button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-color bg-card-bg/40 p-10 text-center text-sm text-text-gray">
          {page.empty}
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-border-color bg-secondary-bg p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-text-white">{row.title}</h3>
                    <span className="rounded-full border border-border-color px-2 py-0.5 text-[10px] text-text-gray">{row.language_code}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${row.is_published ? 'border-emerald-400/20 text-emerald-300' : 'border-amber-400/20 text-amber-200'}`}>
                      {row.is_published ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>
                  {row.content && <p className="mt-2 line-clamp-2 text-xs text-text-gray">{row.content}</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEdit(row)} className="rounded-xl border border-border-color bg-card-bg p-2 text-text-gray hover:text-light-blue">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => deleteRow(row.id)} className="rounded-xl border border-red-400/20 bg-red-500/10 p-2 text-red-200 hover:bg-red-500/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
