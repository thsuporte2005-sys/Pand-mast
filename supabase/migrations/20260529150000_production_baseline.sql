-- Pand mast production baseline
-- Apply with: supabase db push

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  cover_url text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  product_ids text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null unique references public.apps(id) on delete cascade,
  primary_color text not null default '#1E6BFF',
  secondary_color text not null default '#0B2A4A',
  accent_color text not null default '#4DA3FF',
  background_color text not null default '#071A2F',
  text_color text not null default '#F5F8FF',
  custom_domain text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pwa_settings (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null unique references public.apps(id) on delete cascade,
  short_name text,
  theme_color text not null default '#1E6BFF',
  background_color text not null default '#071A2F',
  display text not null default 'standalone',
  orientation text not null default 'portrait',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_pages (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  title text not null,
  slug text not null,
  content text,
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint unique_app_page_slug unique(app_id, slug)
);

create table if not exists public.app_modules (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  name text not null,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.app_modules(id) on delete cascade,
  title text not null,
  description text,
  video_url text,
  video_provider text not null default 'youtube' check (video_provider in ('youtube', 'vimeo', 'wistia', 'panda', 'hls', 'other')),
  order_index integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.app_lessons(id) on delete cascade,
  name text not null,
  url text not null,
  file_type text not null default 'link',
  file_size bigint,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.final_users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text not null unique,
  status text not null default 'active' check (status in ('active', 'blocked')),
  origin text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_app_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'blocked', 'expired')),
  granted_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  platform text,
  transaction_id text,
  constraint unique_user_app unique(user_id, app_id)
);

create table if not exists public.platform_integrations (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique check (platform in ('hotmart', 'kiwify', 'eduzz', 'monetizze', 'cakto', 'cartpanda', 'ticto')),
  api_key text,
  webhook_secret text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  event_type text not null,
  buyer_name text,
  buyer_email text,
  product_id text,
  product_name text,
  transaction_id text,
  order_status text,
  subscription_status text,
  raw_payload jsonb,
  received_at timestamptz not null default timezone('utc', now()),
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  error_message text,
  processed_at timestamptz
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  app_id uuid references public.apps(id) on delete cascade,
  transaction_id text,
  platform text,
  product_id text,
  amount numeric(10,2),
  status text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint unique_order_platform_transaction unique(platform, transaction_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  app_id uuid references public.apps(id) on delete cascade,
  subscription_id text,
  platform text,
  status text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint unique_subscription_platform_id unique(platform, subscription_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  user_id uuid,
  user_email text,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.media_library (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  url text not null,
  file_size bigint,
  mime_type text,
  uploaded_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_apps_slug on public.apps(slug);
create index if not exists idx_apps_product_ids on public.apps(product_ids);
create index if not exists idx_user_app_access_user_app on public.user_app_access(user_id, app_id, status);
create index if not exists idx_webhook_events_received_at on public.webhook_events(received_at desc);
create index if not exists idx_webhook_events_transaction on public.webhook_events(platform, transaction_id);

create or replace function public.update_modified_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_apps_modtime on public.apps;
create trigger update_apps_modtime
  before update on public.apps
  for each row execute function public.update_modified_column();

drop trigger if exists update_app_settings_modtime on public.app_settings;
create trigger update_app_settings_modtime
  before update on public.app_settings
  for each row execute function public.update_modified_column();

create or replace function public.check_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.final_users (id, name, email, status, origin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'active',
    coalesce(new.raw_user_meta_data->>'origin', 'manual')
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.admins enable row level security;
alter table public.apps enable row level security;
alter table public.app_settings enable row level security;
alter table public.pwa_settings enable row level security;
alter table public.app_pages enable row level security;
alter table public.app_modules enable row level security;
alter table public.app_lessons enable row level security;
alter table public.app_files enable row level security;
alter table public.final_users enable row level security;
alter table public.user_app_access enable row level security;
alter table public.platform_integrations enable row level security;
alter table public.webhook_events enable row level security;
alter table public.orders enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.media_library enable row level security;

create policy admin_manage_admins on public.admins for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy admin_read_self on public.admins for select to authenticated using (id = auth.uid() or public.check_is_admin());

create policy admin_all_apps on public.apps for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy public_read_published_apps on public.apps for select to public using (status = 'published');
create policy user_read_authorized_apps on public.apps for select to authenticated using (
  exists (select 1 from public.user_app_access uaa where uaa.user_id = auth.uid() and uaa.app_id = apps.id and uaa.status = 'active')
);

create policy admin_all_app_settings on public.app_settings for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy public_read_app_settings on public.app_settings for select to public using (true);

create policy admin_all_pwa_settings on public.pwa_settings for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy public_read_pwa_settings on public.pwa_settings for select to public using (true);

create policy admin_all_app_pages on public.app_pages for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy user_read_app_pages on public.app_pages for select to authenticated using (
  exists (select 1 from public.user_app_access uaa where uaa.user_id = auth.uid() and uaa.app_id = app_pages.app_id and uaa.status = 'active')
);

create policy admin_all_app_modules on public.app_modules for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy user_read_app_modules on public.app_modules for select to authenticated using (
  exists (select 1 from public.user_app_access uaa where uaa.user_id = auth.uid() and uaa.app_id = app_modules.app_id and uaa.status = 'active')
);

create policy admin_all_app_lessons on public.app_lessons for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy user_read_app_lessons on public.app_lessons for select to authenticated using (
  exists (
    select 1
    from public.app_modules am
    join public.user_app_access uaa on uaa.app_id = am.app_id
    where am.id = app_lessons.module_id
      and uaa.user_id = auth.uid()
      and uaa.status = 'active'
  )
);

create policy admin_all_app_files on public.app_files for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy user_read_app_files on public.app_files for select to authenticated using (
  exists (
    select 1
    from public.app_lessons al
    join public.app_modules am on am.id = al.module_id
    join public.user_app_access uaa on uaa.app_id = am.app_id
    where al.id = app_files.lesson_id
      and uaa.user_id = auth.uid()
      and uaa.status = 'active'
  )
);

create policy admin_all_final_users on public.final_users for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy user_read_self_final_users on public.final_users for select to authenticated using (id = auth.uid());
create policy user_update_self_final_users on public.final_users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy admin_all_user_app_access on public.user_app_access for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy user_read_self_user_app_access on public.user_app_access for select to authenticated using (user_id = auth.uid());

create policy admin_all_platform_integrations on public.platform_integrations for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy admin_all_webhook_events on public.webhook_events for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());

create policy admin_all_orders on public.orders for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy user_read_self_orders on public.orders for select to authenticated using (user_id = auth.uid());

create policy admin_all_subscriptions on public.subscriptions for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy user_read_self_subscriptions on public.subscriptions for select to authenticated using (user_id = auth.uid());

create policy admin_all_audit_logs on public.audit_logs for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());

create policy admin_all_media_library on public.media_library for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());
create policy public_read_media_library on public.media_library for select to public using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']),
  ('app-files', 'app-files', false, 52428800, array['application/pdf', 'application/zip', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy public_read_public_media on storage.objects for select to public using (bucket_id = 'public-media');
create policy admin_all_public_media on storage.objects for all to authenticated using (bucket_id = 'public-media' and public.check_is_admin()) with check (bucket_id = 'public-media' and public.check_is_admin());
create policy admin_all_app_files_storage on storage.objects for all to authenticated using (bucket_id = 'app-files' and public.check_is_admin()) with check (bucket_id = 'app-files' and public.check_is_admin());
create policy user_read_authorized_app_files_storage on storage.objects for select to authenticated using (
  bucket_id = 'app-files'
  and exists (
    select 1
    from public.user_app_access uaa
    where uaa.user_id = auth.uid()
      and uaa.status = 'active'
      and (storage.foldername(name))[1] = uaa.app_id::text
  )
);
