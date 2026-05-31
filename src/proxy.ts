import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

interface ModuleReleaseRecord {
  release_type: string | null;
  release_after_days: number | null;
  is_scheduled_release: boolean | null;
}

interface AccessRecord {
  status: string | null;
  granted_at: string | null;
  access_granted_at: string | null;
}

function isModuleReleased(moduleItem: ModuleReleaseRecord | null, access: AccessRecord | null) {
  if (!moduleItem || !access || access.status !== 'active') return false;

  const isScheduled =
    moduleItem.release_type === 'after_purchase_days' ||
    Boolean(moduleItem.is_scheduled_release);
  const releaseAfterDays = Math.max(0, Number(moduleItem.release_after_days || 0));

  if (!isScheduled || releaseAfterDays === 0) return true;

  const rawAccessDate = access.access_granted_at || access.granted_at;
  if (!rawAccessDate) return false;

  const accessDate = new Date(rawAccessDate);
  if (Number.isNaN(accessDate.getTime())) return false;

  const unlockDate = new Date(accessDate);
  unlockDate.setDate(unlockDate.getDate() + releaseAfterDays);

  return new Date() >= unlockDate;
}

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
          .select('status, granted_at, access_granted_at')
          .eq('user_id', user.id)
          .eq('app_id', app.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!access) {
          return NextResponse.redirect(new URL(`/app/${slug}/login?error=no-access`, request.url));
        }

        let targetModuleId: string | null = null;

        if (subpath === 'modules' && segments[4]) {
          targetModuleId = segments[4];
        }

        if (subpath === 'lessons' && segments[4]) {
          const { data: lesson } = await supabase
            .from('app_lessons')
            .select('module_id')
            .eq('id', segments[4])
            .maybeSingle();

          targetModuleId = lesson?.module_id || null;
        }

        if (targetModuleId) {
          const { data: moduleItem } = await supabase
            .from('app_modules')
            .select('release_type, release_after_days, is_scheduled_release')
            .eq('id', targetModuleId)
            .eq('app_id', app.id)
            .maybeSingle();

          if (!isModuleReleased(moduleItem, access)) {
            return NextResponse.redirect(
              new URL(`/app/${slug}/modules?locked=${targetModuleId}`, request.url)
            );
          }
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/app/:path*'],
};
