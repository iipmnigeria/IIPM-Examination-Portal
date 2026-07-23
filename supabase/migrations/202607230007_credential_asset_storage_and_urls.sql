begin;

alter table public.agilecert_platform_settings
  add column if not exists portal_url text not null
    default 'https://iipmnigeria.github.io/IIPM-Examination-Portal/';

update public.agilecert_platform_settings
set
  portal_url = 'https://iipmnigeria.github.io/IIPM-Examination-Portal/',
  updated_at = now()
where singleton;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'agilecert-credential-assets',
    'agilecert-credential-assets',
    false,
    52428800,
    array['application/pdf']::text[]
  ),
  (
    'agilecert-badge-assets',
    'agilecert-badge-assets',
    true,
    5242880,
    array['image/svg+xml', 'application/json']::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.agilecert_verification_url(p_verification_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rtrim(s.portal_url, '/') || '/?verify=' ||
    replace(replace(trim(p_verification_slug), ' ', '%20'), '+', '%2B')
  from public.agilecert_platform_settings s
  where s.singleton;
$$;

revoke all on function public.agilecert_verification_url(text) from public;
grant execute on function public.agilecert_verification_url(text) to anon, authenticated, service_role;

create or replace function public.normalise_agilecert_badge_share_url()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  select c.verification_slug
  into v_slug
  from public.agilecert_credentials c
  where c.id = new.credential_id;

  if v_slug is not null then
    new.share_url := public.agilecert_verification_url(v_slug);
  end if;

  return new;
end;
$$;

revoke all on function public.normalise_agilecert_badge_share_url() from public;

drop trigger if exists agilecert_normalise_badge_share_url_trigger
  on public.agilecert_digital_badges;
create trigger agilecert_normalise_badge_share_url_trigger
  before insert or update of credential_id, share_url
  on public.agilecert_digital_badges
  for each row
  execute function public.normalise_agilecert_badge_share_url();

update public.agilecert_digital_badges b
set
  share_url = public.agilecert_verification_url(c.verification_slug),
  updated_at = now()
from public.agilecert_credentials c
where c.id = b.credential_id
  and b.share_url is distinct from public.agilecert_verification_url(c.verification_slug);

comment on column public.agilecert_platform_settings.portal_url is
  'Canonical public AgileCert Global portal URL used for credential and badge verification links.';
comment on function public.agilecert_verification_url(text) is
  'Builds the canonical public GitHub Pages verification URL for an AgileCert credential.';

commit;
