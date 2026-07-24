begin;

-- Phase 2.3B: administrator material publication and mapping tools.
-- Candidate downloads and signed delivery remain reserved for Phase 2.4.

alter table public.agilecert_preparation_material_versions
  drop constraint if exists agilecert_material_versions_material_version_key;
alter table public.agilecert_preparation_material_versions
  add constraint agilecert_material_versions_material_version_key
  unique (material_id, version_number);

alter table public.agilecert_preparation_material_versions
  drop constraint if exists agilecert_material_versions_storage_object_key;
alter table public.agilecert_preparation_material_versions
  add constraint agilecert_material_versions_storage_object_key
  unique (storage_bucket, storage_path);

create or replace function public.agilecert_require_material_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id
      and p.role in ('exam_admin', 'super_admin')
      and p.is_active = true
  ) then
    raise exception 'Only an active examination administrator may manage preparation materials.';
  end if;

  return v_user_id;
end;
$$;

create or replace function public.agilecert_stamp_material_admin_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  -- Trusted server/database writes have no end-user UID and may proceed.
  if v_admin_id is not null then
    perform public.agilecert_require_material_admin();
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_admin_id);
    new.created_at := coalesce(new.created_at, now());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists agilecert_materials_admin_stamp
  on public.agilecert_preparation_materials;
create trigger agilecert_materials_admin_stamp
  before insert or update on public.agilecert_preparation_materials
  for each row execute function public.agilecert_stamp_material_admin_write();

drop trigger if exists agilecert_material_versions_admin_stamp
  on public.agilecert_preparation_material_versions;
create trigger agilecert_material_versions_admin_stamp
  before insert or update on public.agilecert_preparation_material_versions
  for each row execute function public.agilecert_stamp_material_admin_write();

drop trigger if exists agilecert_exam_materials_admin_stamp
  on public.agilecert_exam_materials;
create trigger agilecert_exam_materials_admin_stamp
  before insert or update on public.agilecert_exam_materials
  for each row execute function public.agilecert_stamp_material_admin_write();

create or replace function public.get_agilecert_material_admin_console()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.agilecert_require_material_admin();

  return jsonb_build_object(
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'materials', (select count(*) from public.agilecert_preparation_materials),
      'publishedMaterials', (select count(*) from public.agilecert_preparation_materials where status = 'published'),
      'versions', (select count(*) from public.agilecert_preparation_material_versions),
      'publishedVersions', (select count(*) from public.agilecert_preparation_material_versions where status = 'published'),
      'activeMappings', (select count(*) from public.agilecert_exam_materials where is_active),
      'activeEntitlements', (
        select count(*) from public.agilecert_material_entitlements
        where status = 'active' and available_from <= now()
          and (expires_at is null or expires_at > now())
      ),
      'scheduledEntitlements', (
        select count(*) from public.agilecert_material_entitlements
        where status = 'active' and available_from > now()
      )
    ),
    'programmes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'code', p.code, 'name', p.name, 'isActive', p.is_active
      ) order by p.code)
      from public.programmes p
    ), '[]'::jsonb),
    'examinations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'programmeId', e.programme_id,
        'programmeCode', p.code,
        'programmeName', p.name,
        'title', e.title,
        'status', e.status,
        'requiresPayment', e.requires_payment
      ) order by p.code, e.title)
      from public.examinations e
      join public.programmes p on p.id = e.programme_id
    ), '[]'::jsonb),
    'materials', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'description', coalesce(m.description, ''),
        'materialType', m.material_type,
        'status', m.status,
        'createdAt', m.created_at,
        'updatedAt', m.updated_at,
        'versions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', mv.id,
            'versionNumber', mv.version_number,
            'versionLabel', coalesce(mv.version_label, 'Version ' || mv.version_number::text),
            'storageBucket', mv.storage_bucket,
            'storagePath', mv.storage_path,
            'fileName', mv.file_name,
            'mimeType', mv.mime_type,
            'sizeBytes', mv.size_bytes,
            'checksumSha256', mv.checksum_sha256,
            'status', mv.status,
            'publishedAt', mv.published_at,
            'createdAt', mv.created_at,
            'updatedAt', mv.updated_at
          ) order by mv.version_number desc)
          from public.agilecert_preparation_material_versions mv
          where mv.material_id = m.id
        ), '[]'::jsonb),
        'mappings', coalesce((
          select jsonb_agg(jsonb_build_object(
            'examinationId', em.examination_id,
            'examinationTitle', e.title,
            'programmeCode', p.code,
            'position', em.position,
            'isRequired', em.is_required,
            'availableFrom', em.available_from,
            'expiresAt', em.expires_at,
            'isActive', em.is_active,
            'updatedAt', em.updated_at
          ) order by p.code, e.title)
          from public.agilecert_exam_materials em
          join public.examinations e on e.id = em.examination_id
          join public.programmes p on p.id = e.programme_id
          where em.material_id = m.id
        ), '[]'::jsonb),
        'entitlementSummary', (
          select jsonb_build_object(
            'available', count(*) filter (
              where ent.status = 'active' and ent.available_from <= now()
                and (ent.expires_at is null or ent.expires_at > now())
            ),
            'scheduled', count(*) filter (
              where ent.status = 'active' and ent.available_from > now()
            ),
            'expired', count(*) filter (
              where ent.status = 'expired'
                or (ent.expires_at is not null and ent.expires_at <= now())
            ),
            'revoked', count(*) filter (where ent.status = 'revoked')
          )
          from public.agilecert_material_entitlements ent
          where ent.material_id = m.id
        )
      ) order by lower(m.title))
      from public.agilecert_preparation_materials m
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.set_agilecert_material_version_status(
  p_version_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_material_admin();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_version public.agilecert_preparation_material_versions%rowtype;
  v_material_status text;
begin
  if v_status not in ('draft', 'published', 'retired') then
    raise exception 'Unsupported material-version status.';
  end if;

  select * into v_version
  from public.agilecert_preparation_material_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'The material version was not found.';
  end if;

  select status into v_material_status
  from public.agilecert_preparation_materials
  where id = v_version.material_id;

  if v_status = 'published' and v_material_status = 'archived' then
    raise exception 'An archived material cannot publish a version.';
  end if;

  if v_status = 'published' then
    update public.agilecert_preparation_material_versions
    set status = 'retired', updated_at = now()
    where material_id = v_version.material_id
      and id <> v_version.id
      and status = 'published';
  end if;

  update public.agilecert_preparation_material_versions
  set status = v_status,
      published_at = case
        when v_status = 'published' then coalesce(published_at, now())
        else published_at
      end,
      updated_at = now()
  where id = v_version.id
  returning * into v_version;

  if v_status = 'published' then
    update public.agilecert_preparation_materials
    set status = 'published', updated_at = now()
    where id = v_version.material_id;
  elsif not exists (
    select 1 from public.agilecert_preparation_material_versions
    where material_id = v_version.material_id and status = 'published'
  ) then
    update public.agilecert_preparation_materials
    set status = 'draft', updated_at = now()
    where id = v_version.material_id and status = 'published';
  end if;

  return jsonb_build_object(
    'id', v_version.id,
    'materialId', v_version.material_id,
    'versionNumber', v_version.version_number,
    'status', v_version.status,
    'publishedAt', v_version.published_at,
    'updatedBy', v_admin_id,
    'updatedAt', v_version.updated_at
  );
end;
$$;

create or replace function public.reconcile_agilecert_material_entitlements(
  p_examination_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment record;
  v_processed integer := 0;
begin
  perform public.agilecert_require_material_admin();

  for v_assignment in
    select candidate_id, examination_id
    from public.exam_assignments
    where p_examination_id is null or examination_id = p_examination_id
  loop
    perform public.refresh_agilecert_material_entitlements(
      v_assignment.candidate_id,
      v_assignment.examination_id
    );
    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object(
    'examinationId', p_examination_id,
    'assignmentsProcessed', v_processed,
    'activeEntitlements', (
      select count(*) from public.agilecert_material_entitlements ent
      where (p_examination_id is null or ent.examination_id = p_examination_id)
        and ent.status = 'active' and ent.available_from <= now()
        and (ent.expires_at is null or ent.expires_at > now())
    ),
    'scheduledEntitlements', (
      select count(*) from public.agilecert_material_entitlements ent
      where (p_examination_id is null or ent.examination_id = p_examination_id)
        and ent.status = 'active' and ent.available_from > now()
    ),
    'expiredEntitlements', (
      select count(*) from public.agilecert_material_entitlements ent
      where (p_examination_id is null or ent.examination_id = p_examination_id)
        and (ent.status = 'expired'
          or (ent.expires_at is not null and ent.expires_at <= now()))
    ),
    'revokedEntitlements', (
      select count(*) from public.agilecert_material_entitlements ent
      where (p_examination_id is null or ent.examination_id = p_examination_id)
        and ent.status = 'revoked'
    )
  );
end;
$$;

-- Trigger helpers are internal implementation details.
revoke execute on function public.agilecert_stamp_material_admin_write() from public, anon, authenticated;
revoke execute on function public.agilecert_refresh_materials_after_assignment() from public, anon, authenticated;
revoke execute on function public.agilecert_refresh_materials_after_order() from public, anon, authenticated;
revoke execute on function public.agilecert_refresh_materials_after_payment() from public, anon, authenticated;
revoke execute on function public.agilecert_refresh_materials_after_material() from public, anon, authenticated;
revoke execute on function public.agilecert_refresh_materials_after_mapping() from public, anon, authenticated;
revoke execute on function public.agilecert_refresh_materials_after_version() from public, anon, authenticated;
revoke execute on function public.refresh_agilecert_material_entitlements(uuid, uuid) from public, anon, authenticated;

revoke all on function public.agilecert_require_material_admin() from public, anon, authenticated;
revoke all on function public.get_agilecert_material_admin_console() from public, anon, authenticated;
revoke all on function public.set_agilecert_material_version_status(uuid, text) from public, anon, authenticated;
revoke all on function public.reconcile_agilecert_material_entitlements(uuid) from public, anon, authenticated;

grant execute on function public.agilecert_require_material_admin() to authenticated;
grant execute on function public.get_agilecert_material_admin_console() to authenticated;
grant execute on function public.set_agilecert_material_version_status(uuid, text) to authenticated;
grant execute on function public.reconcile_agilecert_material_entitlements(uuid) to authenticated;

comment on function public.get_agilecert_material_admin_console() is
  'Returns administrator-only material records, private version metadata, examination mappings and entitlement summaries.';
comment on function public.set_agilecert_material_version_status(uuid, text) is
  'Publishes, retires or returns a preparation-material version to draft while maintaining one published version.';
comment on function public.reconcile_agilecert_material_entitlements(uuid) is
  'Re-evaluates preparation-material entitlements from authoritative assignment and verified payment records.';

notify pgrst, 'reload schema';

commit;
