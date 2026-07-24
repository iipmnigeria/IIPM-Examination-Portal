begin;

-- Phase 2.3A: preparation-material catalogue, version metadata and
-- payment-verified candidate entitlements. Secure file delivery is excluded
-- until Phase 2.4, so no candidate-facing storage path or signed URL is exposed.

create table if not exists public.agilecert_preparation_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 180),
  description text,
  material_type text not null default 'study_guide'
    check (material_type in ('study_guide', 'workbook', 'mock_exam', 'checklist', 'video', 'reference', 'other')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_preparation_material_versions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.agilecert_preparation_materials(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  version_label text,
  storage_bucket text not null check (length(trim(storage_bucket)) between 2 and 100),
  storage_path text not null check (length(trim(storage_path)) between 3 and 500),
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  mime_type text not null check (length(trim(mime_type)) between 3 and 120),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired')),
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, version_number),
  unique (storage_bucket, storage_path)
);

create unique index if not exists agilecert_one_published_material_version
  on public.agilecert_preparation_material_versions(material_id)
  where status = 'published';

create table if not exists public.agilecert_exam_materials (
  examination_id uuid not null references public.examinations(id) on delete cascade,
  material_id uuid not null references public.agilecert_preparation_materials(id) on delete cascade,
  position integer not null default 1 check (position >= 1),
  is_required boolean not null default false,
  available_from timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (examination_id, material_id),
  check (expires_at is null or available_from is null or expires_at > available_from)
);

create table if not exists public.agilecert_material_entitlements (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  material_id uuid not null references public.agilecert_preparation_materials(id) on delete cascade,
  source_type text not null
    check (source_type in ('paid_order', 'waived_order', 'admin_assignment')),
  source_order_id uuid references public.exam_orders(id) on delete set null,
  source_assignment_id uuid not null references public.exam_assignments(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired')),
  available_from timestamptz not null default now(),
  expires_at timestamptz,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, examination_id, material_id),
  check (expires_at is null or expires_at > available_from),
  check (
    (source_type in ('paid_order', 'waived_order') and source_order_id is not null)
    or (source_type = 'admin_assignment' and source_order_id is null)
  )
);

create index if not exists agilecert_exam_materials_material_idx
  on public.agilecert_exam_materials(material_id, examination_id);
create index if not exists agilecert_material_entitlements_candidate_idx
  on public.agilecert_material_entitlements(candidate_id, status, examination_id);
create index if not exists agilecert_material_entitlements_source_order_idx
  on public.agilecert_material_entitlements(source_order_id)
  where source_order_id is not null;

create or replace function public.refresh_agilecert_material_entitlements(
  p_candidate_id uuid,
  p_examination_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.exam_assignments%rowtype;
  v_order public.exam_orders%rowtype;
  v_source_type text;
  v_source_order_id uuid;
  v_now timestamptz := now();
begin
  select * into v_assignment
  from public.exam_assignments
  where candidate_id = p_candidate_id
    and examination_id = p_examination_id
  order by updated_at desc, created_at desc
  limit 1;

  if not found then
    update public.agilecert_material_entitlements
    set status = 'revoked', revoked_at = coalesce(revoked_at, v_now), updated_at = v_now
    where candidate_id = p_candidate_id
      and examination_id = p_examination_id
      and status = 'active';
    return;
  end if;

  select eo.* into v_order
  from public.exam_orders eo
  where eo.candidate_id = p_candidate_id
    and eo.examination_id = p_examination_id
    and eo.fulfilled_at is not null
    and (
      eo.status = 'waived'
      or (
        eo.status = 'paid'
        and exists (
          select 1
          from public.exam_payments ep
          where ep.order_id = eo.id
            and ep.status = 'success'
            and ep.amount_minor = eo.payable_amount_minor
            and upper(ep.currency) = upper(eo.currency)
        )
      )
    )
  order by eo.fulfilled_at desc, eo.created_at desc
  limit 1;

  if found then
    v_source_type := case when v_order.status = 'waived' then 'waived_order' else 'paid_order' end;
    v_source_order_id := v_order.id;
  elsif v_assignment.assigned_by is not null then
    v_source_type := 'admin_assignment';
    v_source_order_id := null;
  else
    update public.agilecert_material_entitlements
    set status = 'revoked', revoked_at = coalesce(revoked_at, v_now), updated_at = v_now
    where candidate_id = p_candidate_id
      and examination_id = p_examination_id
      and status = 'active';
    return;
  end if;

  if v_assignment.status = 'revoked' then
    update public.agilecert_material_entitlements
    set status = 'revoked', revoked_at = coalesce(revoked_at, v_now), updated_at = v_now
    where candidate_id = p_candidate_id
      and examination_id = p_examination_id
      and status <> 'revoked';
    return;
  end if;

  if v_assignment.status = 'expired'
     or (v_assignment.expires_at is not null and v_assignment.expires_at <= v_now) then
    update public.agilecert_material_entitlements
    set status = 'expired', updated_at = v_now
    where candidate_id = p_candidate_id
      and examination_id = p_examination_id
      and status <> 'expired';
    return;
  end if;

  insert into public.agilecert_material_entitlements (
    candidate_id,
    examination_id,
    material_id,
    source_type,
    source_order_id,
    source_assignment_id,
    status,
    available_from,
    expires_at,
    granted_at,
    revoked_at,
    metadata
  )
  select
    p_candidate_id,
    p_examination_id,
    em.material_id,
    v_source_type,
    v_source_order_id,
    v_assignment.id,
    'active',
    greatest(
      coalesce(v_assignment.available_from, v_now),
      coalesce(em.available_from, v_now)
    ),
    case
      when v_assignment.expires_at is null then em.expires_at
      when em.expires_at is null then v_assignment.expires_at
      else least(v_assignment.expires_at, em.expires_at)
    end,
    v_now,
    null,
    jsonb_build_object('verified_at', v_now)
  from public.agilecert_exam_materials em
  join public.agilecert_preparation_materials m
    on m.id = em.material_id
   and m.status = 'published'
  where em.examination_id = p_examination_id
    and em.is_active = true
    and exists (
      select 1
      from public.agilecert_preparation_material_versions mv
      where mv.material_id = em.material_id
        and mv.status = 'published'
    )
  on conflict (candidate_id, examination_id, material_id) do update
  set source_type = excluded.source_type,
      source_order_id = excluded.source_order_id,
      source_assignment_id = excluded.source_assignment_id,
      status = 'active',
      available_from = excluded.available_from,
      expires_at = excluded.expires_at,
      revoked_at = null,
      metadata = excluded.metadata,
      updated_at = v_now;

  update public.agilecert_material_entitlements ent
  set status = 'revoked', revoked_at = coalesce(ent.revoked_at, v_now), updated_at = v_now
  where ent.candidate_id = p_candidate_id
    and ent.examination_id = p_examination_id
    and ent.status = 'active'
    and not exists (
      select 1
      from public.agilecert_exam_materials em
      join public.agilecert_preparation_materials m
        on m.id = em.material_id
       and m.status = 'published'
      where em.examination_id = p_examination_id
        and em.material_id = ent.material_id
        and em.is_active = true
        and exists (
          select 1
          from public.agilecert_preparation_material_versions mv
          where mv.material_id = em.material_id
            and mv.status = 'published'
        )
    );
end;
$$;

create or replace function public.agilecert_refresh_materials_after_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_agilecert_material_entitlements(
    coalesce(new.candidate_id, old.candidate_id),
    coalesce(new.examination_id, old.examination_id)
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.agilecert_refresh_materials_after_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.fulfilled_at is distinct from old.fulfilled_at then
    perform public.refresh_agilecert_material_entitlements(new.candidate_id, new.examination_id);
  end if;
  return new;
end;
$$;

create or replace function public.agilecert_refresh_materials_after_mapping()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment record;
  v_examination_id uuid := coalesce(new.examination_id, old.examination_id);
  v_material_id uuid := coalesce(new.material_id, old.material_id);
begin
  if tg_op = 'DELETE' then
    update public.agilecert_material_entitlements
    set status = 'revoked', revoked_at = coalesce(revoked_at, now()), updated_at = now()
    where examination_id = v_examination_id
      and material_id = v_material_id
      and status = 'active';
    return old;
  end if;

  for v_assignment in
    select candidate_id, examination_id
    from public.exam_assignments
    where examination_id = v_examination_id
  loop
    perform public.refresh_agilecert_material_entitlements(
      v_assignment.candidate_id,
      v_assignment.examination_id
    );
  end loop;

  return new;
end;
$$;

create or replace function public.agilecert_refresh_materials_after_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapping record;
  v_assignment record;
  v_material_id uuid := coalesce(new.material_id, old.material_id);
begin
  for v_mapping in
    select examination_id
    from public.agilecert_exam_materials
    where material_id = v_material_id
  loop
    for v_assignment in
      select candidate_id, examination_id
      from public.exam_assignments
      where examination_id = v_mapping.examination_id
    loop
      perform public.refresh_agilecert_material_entitlements(
        v_assignment.candidate_id,
        v_assignment.examination_id
      );
    end loop;
  end loop;
  return coalesce(new, old);
end;
$$;

drop trigger if exists agilecert_material_entitlements_assignment_refresh
  on public.exam_assignments;
create trigger agilecert_material_entitlements_assignment_refresh
  after insert or update of status, available_from, expires_at, assigned_by
  on public.exam_assignments
  for each row execute function public.agilecert_refresh_materials_after_assignment();

drop trigger if exists agilecert_material_entitlements_order_refresh
  on public.exam_orders;
create trigger agilecert_material_entitlements_order_refresh
  after insert or update of status, fulfilled_at
  on public.exam_orders
  for each row execute function public.agilecert_refresh_materials_after_order();

drop trigger if exists agilecert_material_entitlements_mapping_refresh
  on public.agilecert_exam_materials;
create trigger agilecert_material_entitlements_mapping_refresh
  after insert or update or delete
  on public.agilecert_exam_materials
  for each row execute function public.agilecert_refresh_materials_after_mapping();

drop trigger if exists agilecert_material_entitlements_version_refresh
  on public.agilecert_preparation_material_versions;
create trigger agilecert_material_entitlements_version_refresh
  after insert or update of status, published_at or delete
  on public.agilecert_preparation_material_versions
  for each row execute function public.agilecert_refresh_materials_after_version();

create or replace function public.get_my_agilecert_preparation_materials()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_assignment record;
  v_result jsonb;
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
    raise exception 'Only an active candidate account may view preparation materials.';
  end if;

  for v_assignment in
    select examination_id
    from public.exam_assignments
    where candidate_id = v_user_id
  loop
    perform public.refresh_agilecert_material_entitlements(v_user_id, v_assignment.examination_id);
  end loop;

  select coalesce(jsonb_agg(material_payload order by examination_title, position, title), '[]'::jsonb)
  into v_result
  from (
    select
      e.title as examination_title,
      em.position,
      m.title,
      jsonb_build_object(
        'materialId', m.id,
        'examinationId', e.id,
        'examinationTitle', e.title,
        'programmeCode', p.code,
        'title', m.title,
        'description', coalesce(m.description, ''),
        'materialType', m.material_type,
        'versionNumber', mv.version_number,
        'versionLabel', coalesce(mv.version_label, 'Version ' || mv.version_number::text),
        'fileName', mv.file_name,
        'mimeType', mv.mime_type,
        'sizeBytes', mv.size_bytes,
        'isRequired', em.is_required,
        'position', em.position,
        'accessStatus', case
          when ent.status = 'active'
            and ent.available_from <= now()
            and (ent.expires_at is null or ent.expires_at > now()) then 'available'
          when ent.status = 'active' and ent.available_from > now() then 'scheduled'
          when ent.status = 'expired'
            or (ent.expires_at is not null and ent.expires_at <= now()) then 'expired'
          when ent.status = 'revoked' then 'revoked'
          else 'locked'
        end,
        'availableFrom', ent.available_from,
        'expiresAt', ent.expires_at,
        'unlockReason', case
          when ent.id is null then 'Complete verified payment or receive an administrator assignment to unlock this material.'
          when ent.status = 'revoked' then 'This material entitlement has been revoked.'
          when ent.status = 'expired' or (ent.expires_at is not null and ent.expires_at <= now()) then 'This material entitlement has expired.'
          when ent.available_from > now() then 'This material will become available at the scheduled time.'
          else null
        end
      ) as material_payload
    from public.agilecert_exam_materials em
    join public.examinations e
      on e.id = em.examination_id
     and e.status = 'published'
    join public.programmes p
      on p.id = e.programme_id
    join public.agilecert_preparation_materials m
      on m.id = em.material_id
     and m.status = 'published'
    join lateral (
      select version_number, version_label, file_name, mime_type, size_bytes
      from public.agilecert_preparation_material_versions candidate_version
      where candidate_version.material_id = m.id
        and candidate_version.status = 'published'
      order by candidate_version.version_number desc
      limit 1
    ) mv on true
    left join public.agilecert_material_entitlements ent
      on ent.candidate_id = v_user_id
     and ent.examination_id = em.examination_id
     and ent.material_id = em.material_id
    where em.is_active = true
  ) catalogue;

  return v_result;
end;
$$;

alter table public.agilecert_preparation_materials enable row level security;
alter table public.agilecert_preparation_material_versions enable row level security;
alter table public.agilecert_exam_materials enable row level security;
alter table public.agilecert_material_entitlements enable row level security;

drop policy if exists agilecert_materials_admin_manage on public.agilecert_preparation_materials;
create policy agilecert_materials_admin_manage
  on public.agilecert_preparation_materials
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

drop policy if exists agilecert_material_versions_admin_manage on public.agilecert_preparation_material_versions;
create policy agilecert_material_versions_admin_manage
  on public.agilecert_preparation_material_versions
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

drop policy if exists agilecert_exam_materials_admin_manage on public.agilecert_exam_materials;
create policy agilecert_exam_materials_admin_manage
  on public.agilecert_exam_materials
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

drop policy if exists agilecert_material_entitlements_select_own on public.agilecert_material_entitlements;
create policy agilecert_material_entitlements_select_own
  on public.agilecert_material_entitlements
  for select
  to authenticated
  using (candidate_id = auth.uid() or public.is_exam_admin());

drop policy if exists agilecert_material_entitlements_admin_manage on public.agilecert_material_entitlements;
create policy agilecert_material_entitlements_admin_manage
  on public.agilecert_material_entitlements
  to authenticated
  using (public.is_exam_admin())
  with check (public.is_exam_admin());

revoke all on public.agilecert_preparation_materials from anon, authenticated;
revoke all on public.agilecert_preparation_material_versions from anon, authenticated;
revoke all on public.agilecert_exam_materials from anon, authenticated;
revoke all on public.agilecert_material_entitlements from anon, authenticated;

grant select, insert, update, delete on public.agilecert_preparation_materials to authenticated;
grant select, insert, update, delete on public.agilecert_preparation_material_versions to authenticated;
grant select, insert, update, delete on public.agilecert_exam_materials to authenticated;
grant select on public.agilecert_material_entitlements to authenticated;

revoke all on function public.refresh_agilecert_material_entitlements(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_my_agilecert_preparation_materials()
  from public, anon, authenticated;
grant execute on function public.get_my_agilecert_preparation_materials()
  to authenticated;

comment on table public.agilecert_preparation_materials is
  'Logical preparation-material records. Candidate access is exposed only through a safe RPC.';
comment on table public.agilecert_preparation_material_versions is
  'Versioned preparation-material storage metadata. Storage bucket and path are never returned to candidates in Phase 2.3A.';
comment on table public.agilecert_exam_materials is
  'Maps preparation materials to examinations with ordering and availability controls.';
comment on table public.agilecert_material_entitlements is
  'Candidate material entitlements derived from verified paid/waived orders or administrator assignments.';
comment on function public.get_my_agilecert_preparation_materials() is
  'Returns locked, scheduled, available, expired or revoked preparation-material metadata without file-delivery credentials.';

commit;
