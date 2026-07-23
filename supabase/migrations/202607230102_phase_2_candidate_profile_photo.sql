begin;

-- Phase 2.2A: private candidate profile-photo storage and profile linkage only.
-- Identity verification, public profile publication and credential functions remain excluded.

alter table public.agilecert_candidate_profiles
  add column if not exists profile_photo_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'candidate-profile-photos',
  'candidate-profile-photos',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- One deterministic private object per candidate. Candidates cannot read,
-- replace or delete another candidate's image.
drop policy if exists candidate_profile_photo_select_own on storage.objects;
create policy candidate_profile_photo_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'candidate-profile-photos'
    and name = auth.uid()::text || '/profile/avatar'
  );

drop policy if exists candidate_profile_photo_insert_own on storage.objects;
create policy candidate_profile_photo_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'candidate-profile-photos'
    and name = auth.uid()::text || '/profile/avatar'
  );

drop policy if exists candidate_profile_photo_update_own on storage.objects;
create policy candidate_profile_photo_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'candidate-profile-photos'
    and name = auth.uid()::text || '/profile/avatar'
  )
  with check (
    bucket_id = 'candidate-profile-photos'
    and name = auth.uid()::text || '/profile/avatar'
  );

drop policy if exists candidate_profile_photo_delete_own on storage.objects;
create policy candidate_profile_photo_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'candidate-profile-photos'
    and name = auth.uid()::text || '/profile/avatar'
  );

create or replace function public.set_my_agilecert_candidate_profile_photo(
  p_profile_photo_path text default null
)
returns public.agilecert_candidate_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expected_path text;
  v_clean_path text := nullif(trim(p_profile_photo_path), '');
  v_profile public.agilecert_candidate_profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'candidate'
      and p.is_active = true
  ) then
    raise exception 'Only active candidate accounts may update candidate photos.';
  end if;

  v_expected_path := v_user_id::text || '/profile/avatar';

  if v_clean_path is not null and v_clean_path <> v_expected_path then
    raise exception 'The candidate photo path is invalid.';
  end if;

  insert into public.agilecert_candidate_profiles (
    user_id,
    profile_photo_path
  )
  values (
    v_user_id,
    v_clean_path
  )
  on conflict (user_id) do update
  set
    profile_photo_path = excluded.profile_photo_path,
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.set_my_agilecert_candidate_profile_photo(text)
  from public, anon, authenticated;
grant execute on function public.set_my_agilecert_candidate_profile_photo(text)
  to authenticated;

comment on column public.agilecert_candidate_profiles.profile_photo_path is
  'Private candidate-owned profile photo path. This is not identity-verification evidence.';

comment on function public.set_my_agilecert_candidate_profile_photo(text) is
  'Links or clears the authenticated active candidate private profile photo using a fixed owned path.';

commit;
