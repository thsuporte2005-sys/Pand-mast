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

    const { data: settings } = await admin
      .from('app_settings')
      .select('display_name, square_icon_url, logo_url, primary_color, background_color')
      .eq('app_id', app.id)
      .maybeSingle();

    const displayName = settings?.display_name || app.display_name || app.name;
    const iconUrl = settings?.square_icon_url || app.square_icon_url || settings?.logo_url || app.logo_url || '/pngs/loggo.png';
    const shortName = pwa?.short_name || displayName.slice(0, 12);
    const themeColor = pwa?.theme_color || settings?.primary_color || '#1E6BFF';
    const bgColor = pwa?.background_color || settings?.background_color || '#071A2F';
    const display = pwa?.display || 'standalone';
    const orientation = pwa?.orientation || 'portrait';

    const manifest = {
      name: displayName,
      short_name: shortName,
      description: app.subtitle || app.description || '',
      start_url: `/app/${slug}/home`,
      display: display,
      orientation: orientation,
      background_color: bgColor,
      theme_color: themeColor,
      icons: [
        {
          src: iconUrl,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: iconUrl,
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
