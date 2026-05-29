import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (path.startsWith('/admin')) {
    if (path === '/admin/login') {
      if (user) {
        const { data: admin } = await supabase
          .from('admins')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (admin) {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }
      }

      return response;
    }

    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!admin) {
      return NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url));
    }
  }

  if (path.startsWith('/app/')) {
    const segments = path.split('/');
    const slug = segments[2];
    const subpath = segments[3];

    if (slug && !slug.includes('.')) {
      if (
        path.endsWith('/manifest.json') ||
        path.endsWith('/sw.js') ||
        path.endsWith('/manifest.webmanifest')
      ) {
        return response;
      }

      if (subpath === 'login' || subpath === undefined || subpath === '') {
        if (subpath === undefined || subpath === '') {
          return NextResponse.redirect(
            new URL(user ? `/app/${slug}/home` : `/app/${slug}/login`, request.url)
          );
        }

        if (user) {
          const { data: app } = await supabase
            .from('apps')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

          if (app) {
            const { data: access } = await supabase
              .from('user_app_access')
              .select('status')
              .eq('user_id', user.id)
              .eq('app_id', app.id)
              .eq('status', 'active')
              .maybeSingle();

            if (access) {
              return NextResponse.redirect(new URL(`/app/${slug}/home`, request.url));
            }
          }
        }

        return response;
      }

      if (!user) {
        return NextResponse.redirect(new URL(`/app/${slug}/login`, request.url));
      }

      const { data: app } = await supabase
        .from('apps')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (!app) {
        return response;
      }

      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!admin) {
        const { data: access } = await supabase
          .from('user_app_access')
          .select('status')
          .eq('user_id', user.id)
          .eq('app_id', app.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!access) {
          return NextResponse.redirect(new URL(`/app/${slug}/login?error=no-access`, request.url));
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/app/:path*'],
};
