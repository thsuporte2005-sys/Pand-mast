-- Pand mast settings reliability
-- Creates initial settings automatically and separates public app assets from general media.

create or replace function public.ensure_app_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_settings (app_id)
  values (new.id)
  on conflict (app_id) do nothing;
  return new;
end;
$$;

insert into public.app_settings (app_id)
select apps.id
from public.apps
left join public.app_settings on app_settings.app_id = apps.id
where app_settings.app_id is null
on conflict (app_id) do nothing;

drop trigger if exists ensure_app_settings_after_app_insert on public.apps;
create trigger ensure_app_settings_after_app_insert
  after insert on public.apps
  for each row execute function public.ensure_app_settings();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-assets',
  'app-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists admin_all_app_assets on storage.objects;
create policy admin_all_app_assets
on storage.objects for all to authenticated
using (bucket_id = 'app-assets' and public.check_is_admin())
with check (bucket_id = 'app-assets' and public.check_is_admin());

drop policy if exists public_read_app_assets on storage.objects;
create policy public_read_app_assets
on storage.objects for select to public
using (bucket_id = 'app-assets');
