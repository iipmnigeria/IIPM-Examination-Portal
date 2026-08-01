begin;

-- ---------------------------------------------------------------------------
-- Certificate renderer examination-code compatibility
--
-- Phase 1A console snapshots and the Phase 1C render context expose an
-- examination code. The production examinations table predates that field.
-- This additive compatibility layer derives a stable display code without
-- changing examination identity, results, pricing, payments or certificates.
-- ---------------------------------------------------------------------------

alter table public.examinations
  add column if not exists code text;

create or replace function public.agilecert_derive_examination_code(
  p_examination_id uuid,
  p_title text,
  p_programme_id uuid,
  p_existing_code text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code text;
  v_programme_code text;
begin
  v_code := upper(nullif(trim(coalesce(p_existing_code, '')), ''));

  if v_code is null then
    v_code := upper(nullif(
      substring(coalesce(p_title, '') from '(?i)(CIPMN-MOD-[0-9]{3})'),
      ''
    ));
  end if;

  if v_code is null and p_programme_id is not null then
    select upper(nullif(trim(programme.code), ''))
    into v_programme_code
    from public.programmes programme
    where programme.id = p_programme_id;
    v_code := v_programme_code;
  end if;

  if v_code is null then
    v_code := 'EXAM-' || upper(substr(
      replace(coalesce(p_examination_id, gen_random_uuid())::text, '-', ''),
      1,
      8
    ));
  end if;

  v_code := regexp_replace(v_code, '[^A-Z0-9._-]+', '-', 'g');
  v_code := trim(both '-' from v_code);

  if length(v_code) < 2 then
    v_code := 'EXAM-' || upper(substr(
      replace(coalesce(p_examination_id, gen_random_uuid())::text, '-', ''),
      1,
      8
    ));
  end if;

  return left(v_code, 80);
end;
$$;

revoke all on function public.agilecert_derive_examination_code(
  uuid, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.agilecert_derive_examination_code(
  uuid, text, uuid, text
) to service_role;

create or replace function public.agilecert_set_examination_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.code := public.agilecert_derive_examination_code(
    new.id,
    new.title,
    new.programme_id,
    new.code
  );
  return new;
end;
$$;

revoke all on function public.agilecert_set_examination_code()
  from public, anon, authenticated;

update public.examinations examination
set code = public.agilecert_derive_examination_code(
  examination.id,
  examination.title,
  examination.programme_id,
  examination.code
)
where examination.code is null
   or length(trim(examination.code)) < 2
   or examination.code <> upper(examination.code)
   or examination.code !~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$';

drop trigger if exists agilecert_examinations_derive_code
  on public.examinations;
create trigger agilecert_examinations_derive_code
  before insert or update of title, programme_id, code
  on public.examinations
  for each row execute function public.agilecert_set_examination_code();

alter table public.examinations
  alter column code set not null;

alter table public.examinations
  drop constraint if exists agilecert_examinations_code_format_check;
alter table public.examinations
  add constraint agilecert_examinations_code_format_check
  check (code ~ '^[A-Z0-9][A-Z0-9._-]{1,79}$');

create index if not exists agilecert_examinations_code_idx
  on public.examinations(code);

comment on column public.examinations.code is
  'Stable renderer-compatible examination/module display code. Existing codes are preserved; missing codes are derived from a CIPMN module token, programme code or examination UUID fallback.';
comment on function public.agilecert_derive_examination_code(uuid,text,uuid,text) is
  'Internal compatibility helper used to keep certificate console and server-render context examination codes available without changing examination identity.';

commit;
