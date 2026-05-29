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
      .select('name, description')
      .eq('slug', slug)
      .single();

    if (app) {
      return {
        title: app.name,
        description: app.description || 'Área de Membros e Treinamentos Privada',
        appleWebApp: {
          capable: true,
          statusBarStyle: 'default',
          title: app.name,
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
