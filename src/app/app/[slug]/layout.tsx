import React from 'react';
import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  
  try {
    const admin = createAdminClient();
    const { data: app } = await admin
      .from('apps')
      .select('id, name, description, display_name, subtitle, logo_url, square_icon_url')
      .eq('slug', slug)
      .single();

    if (app) {
      const { data: settings } = await admin
        .from('app_settings')
        .select('display_name, subtitle, logo_url, square_icon_url')
        .eq('app_id', app.id)
        .maybeSingle();

      const title = settings?.display_name || app.display_name || app.name;
      const description = settings?.subtitle || app.subtitle || app.description || 'Área de Membros e Treinamentos Privada';
      const icon = settings?.square_icon_url || app.square_icon_url || settings?.logo_url || app.logo_url || '/pngs/loggo.png';

      return {
        title,
        description,
        icons: {
          icon,
          apple: icon,
        },
        appleWebApp: {
          capable: true,
          statusBarStyle: 'default',
          title,
        },
        manifest: `/app/${slug}/manifest.json`,
      };
    }
  } catch {
    // Fallback metadata keeps builds safe when runtime env vars are not present.
  }

  return {
    title: 'Pand mast App',
    description: 'Área de Membros Privada',
    manifest: `/app/${slug}/manifest.json`,
  };
}

export default async function AppLayout(props: LayoutProps) {
  await props.params;

  return <>{props.children}</>;
}
