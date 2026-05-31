'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ImagePlus, Loader2, Save, Trash2 } from 'lucide-react';
import { saveAdminAppConfiguration } from '@/lib/admin/app-configuration';
import { sanitizeStorageFileName, validatePublicImage } from '@/lib/app-experience';
import { getErrorMessage, logTechnicalError } from '@/lib/errors';
import { APP_ASSETS_BUCKET } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';

interface CarouselImage {
  id: string;
  image_url: string;
  image_path: string | null;
  alt_text: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function AdminAppCarouselPage() {
  const { id: appId } = useParams() as { id: string };
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [carouselEnabled, setCarouselEnabled] = useState(false);
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCarousel() {
      try {
        const { data: settings, error: settingsError } = await supabase
          .from('app_settings')
          .select('carousel_enabled')
          .eq('app_id', appId)
          .maybeSingle();
        if (settingsError) throw settingsError;
        setCarouselEnabled(Boolean(settings?.carousel_enabled));

        const { data: imageData, error: imagesError } = await supabase
          .from('app_carousel_images')
          .select('*')
          .eq('app_id', appId)
          .order('sort_order', { ascending: true });
        if (imagesError) throw imagesError;
        setImages(imageData || []);
      } catch (err: unknown) {
        logTechnicalError('Carregar carrossel do app', err);
        setError(getErrorMessage(err, 'Falha ao carregar carrossel.'));
      } finally {
        setLoading(false);
      }
    }

    loadCarousel();
  }, [appId, supabase]);

  const saveCarouselEnabled = async (enabled: boolean) => {
    setCarouselEnabled(enabled);
    setSavingToggle(true);
    setMessage(null);
    setError(null);

    try {
      await saveAdminAppConfiguration(appId, 'carousel', { carouselEnabled: enabled });
      setMessage('Status do carrossel atualizado.');
    } catch (err: unknown) {
      setCarouselEnabled(!enabled);
      logTechnicalError('Salvar status do carrossel', err);
      setError(getErrorMessage(err));
    } finally {
      setSavingToggle(false);
    }
  };

  const uploadCarouselImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validatePublicImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const path = `apps/${appId}/carousel/${sanitizeStorageFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(APP_ASSETS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(APP_ASSETS_BUCKET).getPublicUrl(path);
      const nextOrder = images.length === 0 ? 0 : Math.max(...images.map((image) => image.sort_order)) + 1;

      const { data: inserted, error: insertError } = await supabase
        .from('app_carousel_images')
        .insert({
          app_id: appId,
          image_url: data.publicUrl,
          image_path: path,
          alt_text: file.name,
          sort_order: nextOrder,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setImages((current) => [...current, inserted]);
      await saveAdminAppConfiguration(appId, 'audit', {
        auditAction: 'update_carousel',
        changes: { operation: 'upload', image_id: inserted.id, image_path: path },
      });
      setMessage('Imagem adicionada ao carrossel.');
    } catch (err: unknown) {
      logTechnicalError('Upload de imagem do carrossel', err, 'upload');
      setError(getErrorMessage(err, 'Falha ao enviar imagem do carrossel.', 'upload'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const updateImageState = (imageId: string, patch: Partial<CarouselImage>) => {
    setImages((current) =>
      current.map((image) => (image.id === imageId ? { ...image, ...patch } : image))
    );
  };

  const saveImage = async (image: CarouselImage) => {
    setSavingId(image.id);
    setError(null);
    setMessage(null);

    try {
      const { error: updateError } = await supabase
        .from('app_carousel_images')
        .update({
          alt_text: image.alt_text || null,
          sort_order: Number(image.sort_order || 0),
          is_active: image.is_active,
        })
        .eq('id', image.id);

      if (updateError) throw updateError;
      await saveAdminAppConfiguration(appId, 'audit', {
        auditAction: 'update_carousel',
        changes: { operation: 'update', image_id: image.id },
      });
      setMessage('Imagem salva.');
    } catch (err: unknown) {
      logTechnicalError('Salvar imagem do carrossel', err);
      setError(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const deleteImage = async (imageId: string) => {
    if (!confirm('Remover esta imagem do carrossel?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('app_carousel_images')
        .delete()
        .eq('id', imageId);

      if (deleteError) throw deleteError;
      await saveAdminAppConfiguration(appId, 'audit', {
        auditAction: 'update_carousel',
        changes: { operation: 'delete', image_id: imageId },
      });
      setImages((current) => current.filter((image) => image.id !== imageId));
    } catch (err: unknown) {
      logTechnicalError('Excluir imagem do carrossel', err);
      setError(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-accent-blue" />
        <p className="text-sm text-text-gray">Carregando carrossel...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/apps/${appId}/settings`} className="rounded-xl border border-border-color bg-card-bg p-2 text-text-gray hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-text-white">Carrossel</h2>
          <p className="text-sm text-text-gray">Adicione imagens horizontais exibidas no topo do app final.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border-color bg-secondary-bg p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm font-semibold text-text-white">
            <input
              type="checkbox"
              checked={carouselEnabled}
              disabled={savingToggle}
              onChange={(event) => saveCarouselEnabled(event.target.checked)}
            />
            Carrossel ativo no app final
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent-blue px-4 py-2.5 text-xs font-bold text-white hover:bg-light-blue">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Adicionar imagem
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadCarouselImage} className="hidden" />
          </label>
        </div>

        {message && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{message}</p>}
        {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}
      </section>

      {images.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-color bg-card-bg/40 p-10 text-center text-sm text-text-gray">
          Nenhuma imagem adicionada.
        </div>
      ) : (
        <div className="grid gap-4">
          {images.map((image) => (
            <article key={image.id} className="grid gap-4 rounded-2xl border border-border-color bg-secondary-bg p-4 sm:grid-cols-[14rem_1fr_auto]">
              <img src={image.image_url} alt={image.alt_text || ''} className="aspect-[16/9] w-full rounded-xl object-cover" />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs sm:col-span-2">
                  <span className="font-semibold text-text-gray">Texto alternativo</span>
                  <input value={image.alt_text || ''} onChange={(event) => updateImageState(image.id, { alt_text: event.target.value })} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="font-semibold text-text-gray">Ordem</span>
                  <input type="number" value={image.sort_order} onChange={(event) => updateImageState(image.id, { sort_order: Number(event.target.value) })} className="w-full rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-text-white outline-none focus:border-accent-blue" />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-border-color bg-primary-bg px-3.5 py-3 text-xs text-text-white">
                  <input type="checkbox" checked={image.is_active} onChange={(event) => updateImageState(image.id, { is_active: event.target.checked })} />
                  Ativa
                </label>
              </div>
              <div className="flex gap-2 sm:flex-col">
                <button type="button" onClick={() => saveImage(image)} disabled={savingId === image.id} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-blue px-4 py-2 text-xs font-bold text-white hover:bg-light-blue disabled:opacity-60">
                  {savingId === image.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </button>
                <button type="button" onClick={() => deleteImage(image.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-500/20">
                  <Trash2 className="h-4 w-4" />
                  Remover
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
