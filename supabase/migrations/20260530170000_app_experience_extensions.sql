-- Pand mast app experience extensions
-- Adds module covers, scheduled releases, app support, branding, carousel, translations,
-- community posts and notices. Apply after 20260529150000_production_baseline.sql.

alter table public.app_modules
  add column if not exists cover_image_url text,
  add column if not exists cover_image_path text,
  add column if not exists cover_alt_text text,
  add column if not exists release_type text not null default 'immediate',
  add column if not exists release_after_days integer not null default 0,
  add column if not exists is_scheduled_release boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_modules_release_type_check') then
    alter table public.app_modules
      add constraint app_modules_release_type_check
      check (release_type in ('immediate', 'after_purchase_days'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'app_modules_release_after_days_check') then
    alter table public.app_modules
      add constraint app_modules_release_after_days_check
      check (release_after_days >= 0);
  end if;
end $$;

alter table public.user_app_access
  add column if not exists access_granted_at timestamptz,
  add column if not exists final_user_id uuid references public.final_users(id) on delete cascade;

update public.user_app_access
set
  access_granted_at = coalesce(access_granted_at, granted_at, timezone('utc', now())),
  final_user_id = coalesce(final_user_id, user_id)
where access_granted_at is null or final_user_id is null;

alter table public.user_app_access
  alter column access_granted_at set default timezone('utc', now()),
  alter column access_granted_at set not null;

alter table public.final_users
  add column if not exists avatar_url text,
  add column if not exists avatar_path text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.apps
  add column if not exists display_name text,
  add column if not exists subtitle text,
  add column if not exists logo_path text,
  add column if not exists square_icon_url text,
  add column if not exists square_icon_path text,
  add column if not exists brand_mode text not null default 'text',
  add column if not exists brand_font text not null default 'Inter',
  add column if not exists default_language text not null default 'pt-BR';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'apps_brand_mode_check') then
    alter table public.apps
      add constraint apps_brand_mode_check
      check (brand_mode in ('text', 'image'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'apps_default_language_check') then
    alter table public.apps
      add constraint apps_default_language_check
      check (default_language in ('pt-BR', 'en-US', 'es-ES', 'fr-FR'));
  end if;
end $$;

alter table public.app_settings
  add column if not exists support_enabled boolean not null default false,
  add column if not exists support_type text not null default 'whatsapp',
  add column if not exists support_whatsapp text,
  add column if not exists support_email text,
  add column if not exists support_external_url text,
  add column if not exists support_button_text text not null default 'Falar com suporte',
  add column if not exists support_icon_url text,
  add column if not exists support_icon_path text,
  add column if not exists support_position text not null default 'bottom_right',
  add column if not exists carousel_enabled boolean not null default false,
  add column if not exists display_name text,
  add column if not exists subtitle text,
  add column if not exists logo_url text,
  add column if not exists logo_path text,
  add column if not exists square_icon_url text,
  add column if not exists square_icon_path text,
  add column if not exists brand_mode text not null default 'text',
  add column if not exists brand_font text not null default 'Inter';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_settings_support_type_check') then
    alter table public.app_settings
      add constraint app_settings_support_type_check
      check (support_type in ('whatsapp', 'email', 'external_link'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'app_settings_brand_mode_check') then
    alter table public.app_settings
      add constraint app_settings_brand_mode_check
      check (brand_mode in ('text', 'image'));
  end if;
end $$;

create table if not exists public.app_carousel_images (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  image_url text not null,
  image_path text,
  alt_text text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_translations (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  language_code text not null,
  namespace text not null,
  key text not null,
  value text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint app_translations_language_check check (language_code in ('pt-BR', 'en-US', 'es-ES', 'fr-FR')),
  constraint app_translations_unique_key unique(app_id, language_code, namespace, key)
);

create table if not exists public.app_posts (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  title text not null,
  content text,
  language_code text not null default 'pt-BR',
  image_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint app_posts_language_check check (language_code in ('pt-BR', 'en-US', 'es-ES', 'fr-FR'))
);

create table if not exists public.app_notices (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  title text not null,
  content text,
  language_code text not null default 'pt-BR',
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint app_notices_language_check check (language_code in ('pt-BR', 'en-US', 'es-ES', 'fr-FR'))
);

create index if not exists idx_app_modules_release on public.app_modules(app_id, release_type, release_after_days);
create index if not exists idx_user_app_access_final_user_app on public.user_app_access(final_user_id, app_id, status);
create index if not exists idx_app_carousel_images_app_order on public.app_carousel_images(app_id, is_active, sort_order);
create index if not exists idx_app_posts_app_language on public.app_posts(app_id, language_code, is_published, created_at desc);
create index if not exists idx_app_notices_app_language on public.app_notices(app_id, language_code, is_published, created_at desc);
create index if not exists idx_app_translations_app_language on public.app_translations(app_id, language_code, namespace);

drop trigger if exists update_final_users_modtime on public.final_users;
create trigger update_final_users_modtime
  before update on public.final_users
  for each row execute function public.update_modified_column();

drop trigger if exists update_app_translations_modtime on public.app_translations;
create trigger update_app_translations_modtime
  before update on public.app_translations
  for each row execute function public.update_modified_column();

create or replace function public.prevent_final_user_protected_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.check_is_admin() and old.id = auth.uid() then
    new.email := old.email;
    new.status := old.status;
    new.origin := old.origin;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_final_user_self_update on public.final_users;
create trigger protect_final_user_self_update
  before update on public.final_users
  for each row execute function public.prevent_final_user_protected_update();

create or replace function public.user_has_released_module(target_module_id uuid)
returns boolean
language sql
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.app_modules am
    join public.user_app_access uaa on uaa.app_id = am.app_id
    where am.id = target_module_id
      and uaa.user_id = auth.uid()
      and uaa.status = 'active'
      and (
        coalesce(am.release_type, 'immediate') = 'immediate'
        or coalesce(am.is_scheduled_release, false) = false
        or timezone('utc', now()) >= coalesce(uaa.access_granted_at, uaa.granted_at) + make_interval(days => greatest(coalesce(am.release_after_days, 0), 0))
      )
  );
$$;

alter table public.app_carousel_images enable row level security;
alter table public.app_translations enable row level security;
alter table public.app_posts enable row level security;
alter table public.app_notices enable row level security;

drop policy if exists user_read_app_lessons on public.app_lessons;
create policy user_read_released_app_lessons on public.app_lessons for select to authenticated using (
  public.user_has_released_module(app_lessons.module_id)
);

drop policy if exists user_read_app_files on public.app_files;
create policy user_read_released_app_files on public.app_files for select to authenticated using (
  exists (
    select 1
    from public.app_lessons al
    where al.id = app_files.lesson_id
      and public.user_has_released_module(al.module_id)
  )
);

drop policy if exists admin_all_app_carousel_images on public.app_carousel_images;
create policy admin_all_app_carousel_images on public.app_carousel_images for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());

drop policy if exists public_read_active_app_carousel_images on public.app_carousel_images;
create policy public_read_active_app_carousel_images on public.app_carousel_images for select to public using (is_active = true);

drop policy if exists admin_all_app_translations on public.app_translations;
create policy admin_all_app_translations on public.app_translations for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());

drop policy if exists public_read_app_translations on public.app_translations;
create policy public_read_app_translations on public.app_translations for select to public using (true);

drop policy if exists admin_all_app_posts on public.app_posts;
create policy admin_all_app_posts on public.app_posts for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());

drop policy if exists user_read_published_app_posts on public.app_posts;
create policy user_read_published_app_posts on public.app_posts for select to authenticated using (
  is_published = true
  and exists (select 1 from public.user_app_access uaa where uaa.user_id = auth.uid() and uaa.app_id = app_posts.app_id and uaa.status = 'active')
);

drop policy if exists admin_all_app_notices on public.app_notices;
create policy admin_all_app_notices on public.app_notices for all to authenticated using (public.check_is_admin()) with check (public.check_is_admin());

drop policy if exists user_read_published_app_notices on public.app_notices;
create policy user_read_published_app_notices on public.app_notices for select to authenticated using (
  is_published = true
  and exists (select 1 from public.user_app_access uaa where uaa.user_id = auth.uid() and uaa.app_id = app_notices.app_id and uaa.status = 'active')
);

drop policy if exists user_insert_own_public_avatar on storage.objects;
create policy user_insert_own_public_avatar on storage.objects for insert to authenticated with check (
  bucket_id = 'public-media'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists user_update_own_public_avatar on storage.objects;
create policy user_update_own_public_avatar on storage.objects for update to authenticated using (
  bucket_id = 'public-media'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
) with check (
  bucket_id = 'public-media'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists user_delete_own_public_avatar on storage.objects;
create policy user_delete_own_public_avatar on storage.objects for delete to authenticated using (
  bucket_id = 'public-media'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

grant select on public.app_carousel_images, public.app_translations to anon, authenticated;
grant select, insert, update, delete on public.app_carousel_images, public.app_translations, public.app_posts, public.app_notices to authenticated;
