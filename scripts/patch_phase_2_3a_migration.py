from pathlib import Path
import re

path = Path('supabase/migrations/202607240101_phase_2_3a_preparation_material_entitlements.sql')
text = path.read_text()

insert_pattern = re.compile(
    r"  insert into public\.agilecert_material_entitlements \(.*?      updated_at = v_now;\n",
    re.S,
)
insert_replacement = '''  insert into public.agilecert_material_entitlements (
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
    case
      when access_window.expires_at is not null and access_window.expires_at <= v_now then 'expired'
      else 'active'
    end,
    access_window.available_from,
    access_window.expires_at,
    v_now,
    null,
    jsonb_build_object('verified_at', v_now)
  from public.agilecert_exam_materials em
  join public.agilecert_preparation_materials m
    on m.id = em.material_id
   and m.status = 'published'
  cross join lateral (
    select
      greatest(
        coalesce(v_assignment.available_from, v_assignment.created_at, v_now),
        coalesce(em.available_from, em.created_at, v_now),
        case
          when v_source_order_id is not null then coalesce(v_order.fulfilled_at, v_order.created_at, v_now)
          else coalesce(v_assignment.created_at, v_now)
        end
      ) as available_from,
      case
        when v_assignment.expires_at is null then em.expires_at
        when em.expires_at is null then v_assignment.expires_at
        else least(v_assignment.expires_at, em.expires_at)
      end as expires_at
  ) access_window
  where em.examination_id = p_examination_id
    and em.is_active = true
    and (access_window.expires_at is null or access_window.expires_at > access_window.available_from)
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
      status = excluded.status,
      available_from = excluded.available_from,
      expires_at = excluded.expires_at,
      revoked_at = null,
      metadata = excluded.metadata,
      updated_at = v_now;
'''
text, count = insert_pattern.subn(insert_replacement, text, count=1)
if count != 1:
    raise SystemExit(f'Expected one entitlement insert block; replaced {count}.')

mapping_pattern = re.compile(
    r"create or replace function public\.agilecert_refresh_materials_after_mapping\(\).*?\n\$\$;\n",
    re.S,
)
mapping_replacement = '''create or replace function public.agilecert_refresh_materials_after_mapping()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment record;
  v_examination_id uuid;
  v_material_id uuid;
begin
  if tg_op = 'DELETE' then
    v_examination_id := old.examination_id;
    v_material_id := old.material_id;
    update public.agilecert_material_entitlements
    set status = 'revoked', revoked_at = coalesce(revoked_at, now()), updated_at = now()
    where examination_id = v_examination_id
      and material_id = v_material_id
      and status = 'active';
    return old;
  end if;

  v_examination_id := new.examination_id;
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
'''
text, count = mapping_pattern.subn(mapping_replacement, text, count=1)
if count != 1:
    raise SystemExit(f'Expected one mapping trigger function; replaced {count}.')

version_pattern = re.compile(
    r"create or replace function public\.agilecert_refresh_materials_after_version\(\).*?\n\$\$;\n",
    re.S,
)
version_replacement = '''create or replace function public.agilecert_refresh_materials_after_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapping record;
  v_assignment record;
  v_material_id uuid;
begin
  if tg_op = 'DELETE' then
    v_material_id := old.material_id;
  else
    v_material_id := new.material_id;
  end if;

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

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
'''
text, count = version_pattern.subn(version_replacement, text, count=1)
if count != 1:
    raise SystemExit(f'Expected one version trigger function; replaced {count}.')

insertion_marker = 'drop trigger if exists agilecert_material_entitlements_assignment_refresh\n'
extra_functions = '''create or replace function public.agilecert_refresh_materials_after_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapping record;
  v_assignment record;
  v_material_id uuid := new.id;
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
  return new;
end;
$$;

create or replace function public.agilecert_refresh_materials_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  select candidate_id, examination_id into v_order
  from public.exam_orders
  where id = new.order_id;

  if found then
    perform public.refresh_agilecert_material_entitlements(
      v_order.candidate_id,
      v_order.examination_id
    );
  end if;
  return new;
end;
$$;

'''
if insertion_marker not in text:
    raise SystemExit('Trigger insertion marker was not found.')
text = text.replace(insertion_marker, extra_functions + insertion_marker, 1)

old_version_trigger = "create trigger agilecert_material_entitlements_version_refresh\n  after insert or update of status, published_at or delete"
new_version_trigger = "create trigger agilecert_material_entitlements_version_refresh\n  after insert or update or delete"
if old_version_trigger not in text:
    raise SystemExit('The version trigger syntax marker was not found.')
text = text.replace(old_version_trigger, new_version_trigger, 1)

trigger_marker = '''drop trigger if exists agilecert_material_entitlements_mapping_refresh
  on public.agilecert_exam_materials;
'''
new_triggers = '''drop trigger if exists agilecert_material_entitlements_payment_refresh
  on public.exam_payments;
create trigger agilecert_material_entitlements_payment_refresh
  after insert or update of status
  on public.exam_payments
  for each row execute function public.agilecert_refresh_materials_after_payment();

drop trigger if exists agilecert_material_entitlements_material_refresh
  on public.agilecert_preparation_materials;
create trigger agilecert_material_entitlements_material_refresh
  after update of status
  on public.agilecert_preparation_materials
  for each row execute function public.agilecert_refresh_materials_after_material();

'''
if trigger_marker not in text:
    raise SystemExit('Mapping trigger marker was not found.')
text = text.replace(trigger_marker, new_triggers + trigger_marker, 1)

path.write_text(text)
