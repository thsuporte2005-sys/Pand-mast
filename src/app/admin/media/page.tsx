'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Copy, 
  Check, 
  FileText, 
  File, 
  Loader2, 
  AlertCircle,
  ExternalLink,
  Search
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import { PUBLIC_MEDIA_BUCKET } from '@/lib/storage';

interface MediaFile {
  name: string;
  id?: string | null;
  created_at?: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
  } | null;
}

export default function MediaLibraryPage() {
  const supabase = createClient();
  
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: listError } = await supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .list('', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (listError) {
        // If bucket doesn't exist or is not configured
        if (listError.message.includes('not found') || listError.message.includes('does not exist')) {
          setError(`O bucket '${PUBLIC_MEDIA_BUCKET}' não foi encontrado no Supabase Storage. Aplique as migrations antes de usar mídias públicas.`);
          setFiles([]);
        } else {
          throw listError;
        }
      } else {
        setFiles(data || []);
      }
    } catch (err: unknown) {
      console.error('Error fetching media storage:', err);
      setError('Erro ao carregar arquivos: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    
    setUploading(true);
    setError(null);

    const file = fileList[0];
    const fileExt = file.name.split('.').pop();
    const cleanFileName = file.name.split('.')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    const path = `${Date.now()}-${cleanFileName}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Track admin log
      await supabase.from('audit_logs').insert({
        action: 'media_uploaded',
        details: { filename: path },
      });

      await fetchFiles();
    } catch (err: unknown) {
      console.error('Upload error:', err);
      setError(`Falha ao enviar arquivo. Verifique o bucket "${PUBLIC_MEDIA_BUCKET}" no Supabase: ${getErrorMessage(err)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm('Deseja realmente deletar esta mídia permanentemente?')) return;
    setError(null);

    try {
      const { error: deleteError } = await supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .remove([filename]);

      if (deleteError) throw deleteError;

      await supabase.from('audit_logs').insert({
        action: 'media_deleted',
        details: { filename },
      });

      setFiles(files.filter(f => f.name !== filename));
    } catch (err: unknown) {
      alert('Erro ao excluir mídia: ' + getErrorMessage(err));
    }
  };

  const getFileUrl = (filename: string) => {
    const { data } = supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(filename);
    return data.publicUrl;
  };

  const copyUrl = (filename: string) => {
    const url = getFileUrl(filename);
    navigator.clipboard.writeText(url);
    setCopiedName(filename);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter list
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-accent-blue/15 text-light-blue rounded-xl">
            <ImageIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-white">Biblioteca de Mídias</h2>
            <p className="text-xs text-text-gray mt-0.5">Armazene logos, banners de capas e imagens públicas dos apps.</p>
          </div>
        </div>

        <div className="relative">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept="image/*"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-accent-blue hover:bg-light-blue disabled:bg-accent-blue/50 text-text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg shadow-accent-blue/15"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                Enviando Arquivo...
              </>
            ) : (
              <>
                <Upload className="h-4.5 w-4.5" />
                Fazer Upload
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-4 rounded-xl flex gap-2 items-start">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {/* Search files */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-gray/50" />
        <input
          type="text"
          placeholder="Buscar mídias por nome de arquivo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-secondary-bg border border-border-color text-text-white placeholder-text-gray/50 pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:border-accent-blue text-xs"
        />
      </div>

      {/* Grid listing */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          <p className="text-text-gray text-xs">Acessando mídias...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="glass-panel p-12 text-center text-text-gray text-xs rounded-2xl max-w-md mx-auto">
          Nenhum arquivo encontrado na biblioteca. Envie uma imagem pública para vê-la listada aqui.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {filteredFiles.map((file) => {
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
            const isPdf = /\.pdf$/i.test(file.name);
            const fileUrl = getFileUrl(file.name);
            
            return (
              <div 
                key={file.name} 
                className="glass-panel rounded-2xl overflow-hidden flex flex-col justify-between group border hover:border-accent-blue/35 transition duration-300"
              >
                
                {/* Visual Preview container */}
                <div className="aspect-square bg-secondary-bg flex items-center justify-center relative overflow-hidden">
                  {isImage ? (
                    <img 
                      src={fileUrl} 
                      alt={file.name} 
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : isPdf ? (
                    <FileText className="h-12 w-12 text-red-400" />
                  ) : (
                    <File className="h-12 w-12 text-light-blue" />
                  )}
                  
                  {/* Floating badge for file size */}
                  <span className="absolute bottom-2 right-2 bg-primary-bg/75 backdrop-blur px-2 py-0.5 rounded text-[9px] font-mono text-text-white border border-border-color/40">
                    {formatSize(file.metadata?.size)}
                  </span>
                </div>

                {/* Details Footer */}
                <div className="p-3 bg-secondary-bg/30 border-t border-border-color/30 space-y-2.5">
                  <p className="text-[10px] font-semibold text-text-white truncate" title={file.name}>
                    {file.name}
                  </p>

                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-border-color/20 justify-end">
                    <button
                      onClick={() => copyUrl(file.name)}
                      className="p-1.5 hover:bg-card-bg rounded-lg text-text-gray hover:text-white transition flex items-center justify-center"
                      title="Copiar URL Pública"
                    >
                      {copiedName === file.name ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-card-bg rounded-lg text-text-gray hover:text-white transition flex items-center justify-center"
                      title="Visualizar Mídia"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => handleDelete(file.name)}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg text-text-gray hover:text-red-400 transition flex items-center justify-center"
                      title="Excluir Mídia"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
