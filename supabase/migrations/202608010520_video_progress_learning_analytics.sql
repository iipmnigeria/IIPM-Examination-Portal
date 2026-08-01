begin;

-- Video progress and learning analytics.
-- Google Drive preview playback does not expose current-time or seek events to the
-- portal. This release therefore records authoritative playback openings from the
-- existing server-side authorisation audit, candidate-controlled lesson completion,
-- viewing history and administrator engagement reports. The schema reserves exact
-- position, duration and engaged-seconds fields for a future controllable player.

create table if not exists public.agilecert_video_learning_progress (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  material_id uuid not null references public.agilecert_preparation_materials(id) on delete cascade,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0 check (open_count >= 0),
  engaged_seconds bigint not null default 0 check (engaged_seconds >= 0),
  last_position_seconds numeric(12,3),
  duration_seconds numeric(12,3),
  completion_percent numeric(5,2) not null default 0 check (completion_percent >= 0 and completion_percent <= 100),
  completed_at timestamptz,
  completion_source text check (completion_source is null or completion_source in ('manual', 'player', 'administrator')),
  last_playback_audit_id uuid references public.agilecert_material_playback_audits(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, examination_id, material_id)
);

create index if not exists agilecert_video_learning_progress_candidate_idx
  on public.agilecert_video_learning_progress(candidate_id, last_opened_at desc nulls last);
create index if not exists agilecert_video_learning_progress_material_idx
  on public.agilecert_video_learning_progress(material_id, last_opened_at desc nulls last);
create index if not exists agilecert_video_learning_progress_completion_idx
  on public.agilecert_video_learning_progress(completed_at desc nulls last);

alter table public.agilecert_video_learning_progress enable row level security;
revoke all on public.agilecert_video_learning_progress from public, anon, authenticated;
grant select on public.agilecert_video_learning_progress to authenticated;

drop policy if exists agilecert_video_learning_progress_select
  on public.agilecert_video_learning_progress;
create policy agilecert_video_learning_progress_select
  on public.agilecert_video_learning_progress
  for select
  to authenticated
  using (
    candidate_id = auth.uid()
    or public.agilecert_is_material_admin()
  );

create or replace function public.capture_agilecert_video_playback_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'authorized' then
    return new;
  end if;

  if not exists (
    select 1
    from public.agilecert_preparation_materials material
    where material.id = new.material_id
      and material.material_type = 'video'
  ) then
    return new;
  end if;

  insert into public.agilecert_video_learning_progress (
    candidate_id,
    examination_id,
    material_id,
    first_opened_at,
    last_opened_at,
    open_count,
    last_playback_audit_id,
    metadata
  ) values (
    new.candidate_id,
    new.examination_id,
    new.material_id,
    new.requested_at,
    new.requested_at,
    1,
    new.id,
    jsonb_build_object('provider', new.provider, 'progressMode', 'authorisation_and_manual_completion')
  )
  on conflict (candidate_id, examination_id, material_id) do update
  set first_opened_at = coalesce(public.agilecert_video_learning_progress.first_opened_at, excluded.first_opened_at),
      last_opened_at = greatest(
        coalesce(public.agilecert_video_learning_progress.last_opened_at, excluded.last_opened_at),
        excluded.last_opened_at
      ),
      open_count = public.agilecert_video_learning_progress.open_count + 1,
      last_playback_audit_id = excluded.last_playback_audit_id,
      metadata = public.agilecert_video_learning_progress.metadata || excluded.metadata,
      updated_at = now();

  return new;
end;
$$;

revoke all on function public.capture_agilecert_video_playback_progress()
  from public, anon, authenticated;

drop trigger if exists agilecert_video_playback_progress_capture
  on public.agilecert_material_playback_audits;
create trigger agilecert_video_playback_progress_capture
  after insert on public.agilecert_material_playback_audits
  for each row
  execute function public.capture_agilecert_video_playback_progress();

-- Reconstruct authoritative opening history from existing authorised playback audits.
insert into public.agilecert_video_learning_progress (
  candidate_id,
  examination_id,
  material_id,
  first_opened_at,
  last_opened_at,
  open_count,
  last_playback_audit_id,
  metadata
)
select
  audit.candidate_id,
  audit.examination_id,
  audit.material_id,
  min(audit.requested_at),
  max(audit.requested_at),
  count(*)::integer,
  (array_agg(audit.id order by audit.requested_at desc))[1],
  jsonb_build_object(
    'provider', max(audit.provider),
    'progressMode', 'authorisation_and_manual_completion',
    'backfilledAt', now()
  )
from public.agilecert_material_playback_audits audit
join public.agilecert_preparation_materials material
  on material.id = audit.material_id
 and material.material_type = 'video'
where audit.status = 'authorized'
group by audit.candidate_id, audit.examination_id, audit.material_id
on conflict (candidate_id, examination_id, material_id) do update
set first_opened_at = least(
      coalesce(public.agilecert_video_learning_progress.first_opened_at, excluded.first_opened_at),
      excluded.first_opened_at
    ),
    last_opened_at = greatest(
      coalesce(public.agilecert_video_learning_progress.last_opened_at, excluded.last_opened_at),
      excluded.last_opened_at
    ),
    open_count = greatest(public.agilecert_video_learning_progress.open_count, excluded.open_count),
    last_playback_audit_id = excluded.last_playback_audit_id,
    metadata = public.agilecert_video_learning_progress.metadata || excluded.metadata,
    updated_at = now();

create or replace function public.set_my_agilecert_video_lesson_completion(
  p_examination_id uuid,
  p_material_id uuid,
  p_completed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_progress public.agilecert_video_learning_progress%rowtype;
begin
  if v_candidate_id is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = v_candidate_id
      and profile.role = 'candidate'
      and profile.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  perform public.refresh_agilecert_material_entitlements(v_candidate_id, p_examination_id);

  if not exists (
    select 1
    from public.agilecert_exam_materials mapping
    join public.agilecert_preparation_materials material
      on material.id = mapping.material_id
    join public.agilecert_material_entitlements entitlement
      on entitlement.candidate_id = v_candidate_id
     and entitlement.examination_id = mapping.examination_id
     and entitlement.material_id = mapping.material_id
    where mapping.examination_id = p_examination_id
      and mapping.material_id = p_material_id
      and mapping.is_active = true
      and material.material_type = 'video'
      and material.status = 'published'
      and entitlement.status = 'active'
      and entitlement.available_from <= now()
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  ) then
    raise exception 'Current authorised video access is required.';
  end if;

  insert into public.agilecert_video_learning_progress (
    candidate_id,
    examination_id,
    material_id,
    completion_percent,
    completed_at,
    completion_source,
    metadata
  ) values (
    v_candidate_id,
    p_examination_id,
    p_material_id,
    case when p_completed then 100 else 0 end,
    case when p_completed then now() else null end,
    case when p_completed then 'manual' else null end,
    jsonb_build_object(
      'progressMode', 'authorisation_and_manual_completion',
      'exactResumeSupported', false
    )
  )
  on conflict (candidate_id, examination_id, material_id) do update
  set completion_percent = excluded.completion_percent,
      completed_at = excluded.completed_at,
      completion_source = excluded.completion_source,
      metadata = public.agilecert_video_learning_progress.metadata || excluded.metadata,
      updated_at = now()
  returning * into v_progress;

  return jsonb_build_object(
    'materialId', v_progress.material_id,
    'examinationId', v_progress.examination_id,
    'completed', v_progress.completed_at is not null,
    'completionPercent', v_progress.completion_percent,
    'completedAt', v_progress.completed_at,
    'openCount', v_progress.open_count,
    'lastOpenedAt', v_progress.last_opened_at
  );
end;
$$;

revoke all on function public.set_my_agilecert_video_lesson_completion(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_my_agilecert_video_lesson_completion(uuid, uuid, boolean)
  to authenticated;

create or replace function public.get_my_agilecert_video_learning_progress()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_candidate_id is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = v_candidate_id
      and profile.role = 'candidate'
      and profile.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  select coalesce(jsonb_agg(payload order by last_opened_at desc nulls last, examination_title, position), '[]'::jsonb)
  into v_result
  from (
    select
      examination.title as examination_title,
      mapping.position,
      progress.last_opened_at,
      jsonb_build_object(
        'candidateId', v_candidate_id,
        'examinationId', examination.id,
        'examinationTitle', examination.title,
        'programmeCode', programme.code,
        'materialId', material.id,
        'materialTitle', material.title,
        'position', mapping.position,
        'firstOpenedAt', progress.first_opened_at,
        'lastOpenedAt', progress.last_opened_at,
        'openCount', coalesce(progress.open_count, 0),
        'engagedSeconds', coalesce(progress.engaged_seconds, 0),
        'lastPositionSeconds', progress.last_position_seconds,
        'durationSeconds', progress.duration_seconds,
        'completionPercent', coalesce(progress.completion_percent, 0),
        'completed', progress.completed_at is not null,
        'completedAt', progress.completed_at,
        'completionSource', progress.completion_source,
        'provider', manifest.source_provider,
        'exactResumeSupported', manifest.source_provider <> 'google_drive',
        'progressMode', case
          when manifest.source_provider = 'google_drive' then 'authorisation_and_manual_completion'
          else 'player_progress'
        end
      ) as payload
    from public.agilecert_exam_materials mapping
    join public.examinations examination
      on examination.id = mapping.examination_id
     and examination.status = 'published'
    join public.programmes programme
      on programme.id = examination.programme_id
    join public.agilecert_preparation_materials material
      on material.id = mapping.material_id
     and material.status = 'published'
     and material.material_type = 'video'
    join public.agilecert_material_entitlements entitlement
      on entitlement.candidate_id = v_candidate_id
     and entitlement.examination_id = mapping.examination_id
     and entitlement.material_id = mapping.material_id
     and entitlement.status = 'active'
     and entitlement.available_from <= now()
     and (entitlement.expires_at is null or entitlement.expires_at > now())
    left join public.agilecert_material_source_manifests manifest
      on manifest.material_id = material.id
     and manifest.delivery_mode = 'embedded_video'
    left join public.agilecert_video_learning_progress progress
      on progress.candidate_id = v_candidate_id
     and progress.examination_id = mapping.examination_id
     and progress.material_id = mapping.material_id
    where mapping.is_active = true
  ) records;

  return v_result;
end;
$$;

revoke all on function public.get_my_agilecert_video_learning_progress()
  from public, anon, authenticated;
grant execute on function public.get_my_agilecert_video_learning_progress()
  to authenticated;

create or replace function public.get_agilecert_video_learning_analytics(
  p_programme_code text default null,
  p_search text default null,
  p_limit integer default 500,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 1000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if auth.uid() is null or not public.agilecert_is_material_admin() then
    raise exception 'Material administrator access is required.';
  end if;

  with records as (
    select
      progress.candidate_id,
      coalesce(profile.full_name, auth_user.email, 'Candidate') as candidate_name,
      coalesce(auth_user.email, '') as email,
      profile.candidate_code,
      programme.code as programme_code,
      examination.id as examination_id,
      examination.title as examination_title,
      material.id as material_id,
      material.title as material_title,
      progress.first_opened_at,
      progress.last_opened_at,
      progress.open_count,
      progress.engaged_seconds,
      progress.last_position_seconds,
      progress.duration_seconds,
      progress.completion_percent,
      progress.completed_at,
      progress.completion_source,
      coalesce(manifest.source_provider, 'other') as provider,
      count(*) over() as filtered_total
    from public.agilecert_video_learning_progress progress
    join public.profiles profile on profile.id = progress.candidate_id
    left join auth.users auth_user on auth_user.id = progress.candidate_id
    join public.examinations examination on examination.id = progress.examination_id
    join public.programmes programme on programme.id = examination.programme_id
    join public.agilecert_preparation_materials material on material.id = progress.material_id
    left join public.agilecert_material_source_manifests manifest
      on manifest.material_id = progress.material_id
     and manifest.delivery_mode = 'embedded_video'
    where (nullif(trim(coalesce(p_programme_code, '')), '') is null
      or upper(programme.code) = upper(trim(p_programme_code)))
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or coalesce(profile.full_name, '') ilike '%' || trim(p_search) || '%'
        or coalesce(auth_user.email, '') ilike '%' || trim(p_search) || '%'
        or coalesce(profile.candidate_code, '') ilike '%' || trim(p_search) || '%'
        or examination.title ilike '%' || trim(p_search) || '%'
        or material.title ilike '%' || trim(p_search) || '%'
      )
  ),
  paged as (
    select *
    from records
    order by last_opened_at desc nulls last, candidate_name, material_title
    limit v_limit offset v_offset
  ),
  summary as (
    select
      count(*)::integer as lesson_records,
      count(distinct candidate_id)::integer as engaged_candidates,
      coalesce(sum(open_count), 0)::bigint as authorised_opens,
      count(*) filter (where completed_at is not null)::integer as completed_lessons,
      count(*) filter (where last_opened_at >= now() - interval '30 days')::integer as active_last_30_days,
      case when count(*) = 0 then 0
        else round((count(*) filter (where completed_at is not null)::numeric / count(*)::numeric) * 100, 2)
      end as completion_rate
    from records
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'lessonRecords', summary.lesson_records,
      'engagedCandidates', summary.engaged_candidates,
      'authorisedOpens', summary.authorised_opens,
      'completedLessons', summary.completed_lessons,
      'activeLast30Days', summary.active_last_30_days,
      'completionRate', summary.completion_rate,
      'exactResumeSupportedForGoogleDrive', false
    ),
    'total', coalesce((select max(filtered_total) from paged), 0),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'candidateId', candidate_id,
        'candidateName', candidate_name,
        'email', email,
        'candidateCode', candidate_code,
        'programmeCode', programme_code,
        'examinationId', examination_id,
        'examinationTitle', examination_title,
        'materialId', material_id,
        'materialTitle', material_title,
        'firstOpenedAt', first_opened_at,
        'lastOpenedAt', last_opened_at,
        'openCount', open_count,
        'engagedSeconds', engaged_seconds,
        'lastPositionSeconds', last_position_seconds,
        'durationSeconds', duration_seconds,
        'completionPercent', completion_percent,
        'completed', completed_at is not null,
        'completedAt', completed_at,
        'completionSource', completion_source,
        'provider', provider,
        'exactResumeSupported', provider <> 'google_drive'
      ) order by last_opened_at desc nulls last, candidate_name, material_title)
      from paged
    ), '[]'::jsonb)
  ) into v_result
  from summary;

  return v_result;
end;
$$;

revoke all on function public.get_agilecert_video_learning_analytics(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_agilecert_video_learning_analytics(text, text, integer, integer)
  to authenticated;

comment on table public.agilecert_video_learning_progress is
  'Authoritative video opening history and lesson completion. Exact playback position remains nullable until a controllable video player is introduced.';

-- Fail closed unless the expected schema authority is present.
do $verify$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'agilecert_video_playback_progress_capture'
      and not tgisinternal
  ) then
    raise exception 'Video playback progress trigger was not created.';
  end if;

  if not exists (
    select 1 from pg_proc
    where proname = 'get_my_agilecert_video_learning_progress'
  ) then
    raise exception 'Candidate video learning progress RPC was not created.';
  end if;

  if not exists (
    select 1 from pg_proc
    where proname = 'get_agilecert_video_learning_analytics'
  ) then
    raise exception 'Administrator video learning analytics RPC was not created.';
  end if;
end;
$verify$;

commit;
