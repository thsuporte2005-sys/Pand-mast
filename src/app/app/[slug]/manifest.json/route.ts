import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getErrorMessage } from '@/lib/errors';

export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await props.params;
    const admin = createAdminClient();

    // 1. Fetch App details
    const { data: app, error: appErr } = await admin
      .from('apps')
      .select('*')
      .eq('slug', slug)
      .single();

    if (appErr || !app) {
      return new Response('App not found', { status: 404 });
    }

    // 2. Fetch PWA settings
    const { data: pwa } = await admin
      .from('pwa_settings')
      .select('*')
      .eq('app_id', app.id)
      .maybeSingle();

    const shortName = pwa?.short_name || app.name.slice(0, 12);
    const themeColor = pwa?.theme_color || '#1E6BFF';
    const bgColor = pwa?.background_color || '#071A2F';
    const display = pwa?.display || 'standalone';
    const orientation = pwa?.orientation || 'portrait';

    const manifest = {
      name: app.name,
      short_name: shortName,
      description: app.description || '',
      start_url: `/app/${slug}/home`,
      display: display,
      orientation: orientation,
      background_color: bgColor,
      theme_color: themeColor,
      icons: [
        {
          src: app.logo_url || '/pngs/loggo.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: app.logo_url || '/pngs/loggo.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
      }
    });
  } catch (err: unknown) {
    console.error('Manifest generation error:', err);
    return new Response(getErrorMessage(err, 'Internal Server Error'), { status: 500 });
  }
}
