begin;

create temp table agilecert_examination_code_test_target on commit drop as
select id, code as original_code
from public.examinations
order by id
limit 1;

do $$
declare
  v_nullable text;
  v_trigger_count integer;
  v_invalid_count integer;
  v_function_count integer;
  v_definition text;
begin
  select columns.is_nullable
  into v_nullable
  from information_schema.columns columns
  where columns.table_schema = 'public'
    and columns.table_name = 'examinations'
    and columns.column_name = 'code';

  if v_nullable is distinct from 'NO' then
    raise exception 'Examination code compatibility column is missing or nullable.';
  end if;

  select count(*)
  into v_trigger_count
  from pg_trigger trigger_row
  where trigger_row.tgrelid = 'public.examinations'::regclass
    and trigger_row.tgname = 'agilecert_examinations_derive_code'
    and not trigger_row.tgisinternal;

  if v_trigger_count <> 1 then
    raise exception 'Examination code derivation trigger is not active.';
  end if;

  select count(*)
  into v_invalid_count
  from public.examinations examination
  where examination.code is null
     or examination.code !~ '^[A-Z0-9][A-Z0-9._-]{1,79}$';

  if v_invalid_count <> 0 then
    raise exception 'Existing examinations contain missing or invalid renderer codes.';
  end if;

  select count(*)
  into v_function_count
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname in (
      'agilecert_derive_examination_code',
      'agilecert_set_examination_code'
    )
    and function_row.prosecdef;

  if v_function_count <> 2 then
    raise exception 'Examination code compatibility helpers must remain security-definer controlled.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.agilecert_derive_examination_code(uuid,text,uuid,text)',
    'execute'
  ) then
    raise exception 'Authenticated browser users must not execute the compatibility helper directly.';
  end if;

  select pg_get_functiondef(function_row.oid)
  into v_definition
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname = 'get_agilecert_certificate_server_render_context'
  limit 1;

  if v_definition is null or position('v_examination.code' in v_definition) = 0 then
    raise exception 'The Phase 1C render context no longer exposes the examination code contract.';
  end if;
end;
$$;

do $$
declare
  v_target uuid;
  v_code text;
begin
  select id into v_target
  from agilecert_examination_code_test_target
  limit 1;

  if v_target is not null then
    update public.examinations
    set code = null
    where id = v_target;

    select code into v_code
    from public.examinations
    where id = v_target;

    if v_code is null or v_code !~ '^[A-Z0-9][A-Z0-9._-]{1,79}$' then
      raise exception 'The compatibility trigger did not derive a valid code on update.';
    end if;
  end if;
end;
$$;

select jsonb_build_object(
  'certificateRendererExaminationCodeCompatibilityVerified', true,
  'examinations', (select count(*) from public.examinations),
  'nonEmptyCodes', (
    select count(*) from public.examinations
    where code is not null and length(code) >= 2
  ),
  'triggerActive', exists (
    select 1 from pg_trigger
    where tgrelid = 'public.examinations'::regclass
      and tgname = 'agilecert_examinations_derive_code'
      and not tgisinternal
  )
) as verification;

rollback;
