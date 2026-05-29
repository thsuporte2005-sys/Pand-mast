'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Layers, 
  Plus, 
  ExternalLink, 
  Settings, 
  Users, 
  Video, 
  FileText, 
  Globe,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';

interface AppItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  status: 'draft' | 'published';
  product_ids: string | null;
  created_at: string;
}

export default function AdminAppsPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteAppId, setDeleteAppId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  const supabase = createClient();

  const fetchApps = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApps(data || []);
    } catch (err) {
      console.error('Error fetching apps:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleDelete = async (appId: string) => {
    try {
      setDeleting(true);
      const { error } = await supabase
        .from('apps')
        .delete()
        .eq('id', appId);

      if (error) throw error;
      setApps(apps.filter(app => app.id !== appId));
      setDeleteAppId(null);
    } catch (err: unknown) {
      alert('Erro ao excluir app: ' + getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-gray text-sm">Carregando seus aplicativos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-white">Meus Aplicativos</h2>
          <p className="text-text-gray text-sm mt-1">Gerencie, configure e edite o conteúdo de seus web apps.</p>
        </div>
        <Link
          href="/admin/apps/new"
          className="self-start sm:self-auto flex items-center gap-2 bg-accent-blue hover:bg-light-blue text-text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-accent-blue/15"
        >
          <Plus className="h-4.5 w-4.5" />
          Criar Novo App
        </Link>
      </div>

      {/* Grid List */}
      {apps.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-5 max-w-xl mx-auto mt-8 border-dashed border-2">
          <div className="h-14 w-14 rounded-full bg-accent-blue/15 flex items-center justify-center text-light-blue mx-auto">
            <Layers className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-text-white">Nenhum aplicativo encontrado</h3>
            <p className="text-text-gray text-sm">
              Você ainda não criou nenhum web app. Crie um aplicativo para hospedar seus módulos, aulas e disponibilizar para seus alunos.
            </p>
          </div>
          <Link
            href="/admin/apps/new"
            className="inline-flex items-center gap-2 bg-accent-blue hover:bg-light-blue text-text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            Criar meu primeiro App
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => (
            <div key={app.id} className="glass-panel rounded-2xl flex flex-col justify-between overflow-hidden hover:border-accent-blue/40 transition-all duration-300">
              
              {/* App details body */}
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-secondary-bg border border-border-color flex items-center justify-center text-light-blue overflow-hidden shrink-0">
                      {app.logo_url ? (
                        <img src={app.logo_url} alt={app.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <Layers className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-text-white truncate">{app.name}</h4>
                      <p className="text-xs text-text-gray font-mono truncate">/app/{app.slug}</p>
                    </div>
                  </div>
                  
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    app.status === 'published'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {app.status === 'published' ? 'Publicado' : 'Rascunho'}
                  </span>
                </div>

                <p className="text-xs text-text-gray line-clamp-2 min-h-[2.5rem]">
                  {app.description || 'Nenhuma descrição informada.'}
                </p>

                {app.product_ids && (
                  <div className="bg-primary-bg/50 border border-border-color/30 rounded-lg p-2.5 text-[11px] text-text-gray font-mono truncate">
                    <span className="font-semibold text-text-white block text-[9px] uppercase tracking-wider mb-0.5">Ids de Vendas Vinculados:</span>
                    {app.product_ids}
                  </div>
                )}
              </div>

              {/* Bottom quick actions */}
              <div className="bg-secondary-bg/50 border-t border-border-color/60 px-6 py-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/admin/apps/${app.id}/editor`}
                    className="p-2 text-text-gray hover:text-light-blue bg-card-bg hover:bg-primary-bg rounded-lg border border-border-color/40 transition-all text-xs flex items-center gap-1.5"
                    title="Editor Visual"
                  >
                    <Video className="h-4 w-4" />
                    Editor
                  </Link>
                  <Link
                    href={`/admin/apps/${app.id}/settings`}
                    className="p-2 text-text-gray hover:text-light-blue bg-card-bg hover:bg-primary-bg rounded-lg border border-border-color/40 transition-all text-xs flex items-center gap-1.5"
                    title="Configurações e Cores"
                  >
                    <Settings className="h-4 w-4" />
                    Config
                  </Link>
                  <Link
                    href={`/admin/apps/${app.id}/users`}
                    className="p-2 text-text-gray hover:text-light-blue bg-card-bg hover:bg-primary-bg rounded-lg border border-border-color/40 transition-all text-xs flex items-center gap-1.5"
                    title="Alunos com acesso"
                  >
                    <Users className="h-4 w-4" />
                    Alunos
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/app/${app.slug}`}
                    target="_blank"
                    className="p-2 text-text-gray hover:text-text-white hover:bg-primary-bg rounded-lg transition-all"
                    title="Ver App Final"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => setDeleteAppId(app.id)}
                    className="p-2 text-text-gray hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Excluir App"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteAppId && (
        <div className="fixed inset-0 bg-primary-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-secondary-bg border border-border-color max-w-md w-full p-6 rounded-2xl shadow-2xl space-y-6">
            <div className="flex gap-3.5 items-start">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-white">Confirmar Exclusão</h3>
                <p className="text-text-gray text-xs mt-1.5 leading-relaxed">
                  Tem certeza que deseja excluir este aplicativo? Esta ação é irreversível e irá deletar permanentemente todos os módulos, aulas, arquivos associados e acessos de alunos vinculados a este aplicativo.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteAppId(null)}
                disabled={deleting}
                className="bg-card-bg hover:bg-border-color border border-border-color/80 text-text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteAppId)}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-500 text-text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5"
              >
                {deleting ? 'Excluindo...' : 'Excluir Aplicativo'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
