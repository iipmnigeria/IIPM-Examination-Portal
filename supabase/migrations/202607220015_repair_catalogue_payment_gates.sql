begin;

-- Repair every published examination under the approved IIPM catalogue, including
-- any older duplicate examination records that may pre-date migration 014.
with target_examinations as (
  select e.id
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where p.code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
    and e.status = 'published'
)
update public.examinations e
set requires_payment = true,
    allow_self_enrollment = false,
    updated_at = now()
from target_examinations target
where e.id = target.id;

-- Clear any competing default currency before making NGN the default.
with target_examinations as (
  select e.id
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where p.code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
    and e.status = 'published'
)
update public.exam_prices ep
set is_default = false,
    updated_at = now()
from target_examinations target
where ep.examination_id = target.id
  and ep.is_default = true;

-- NGN 25,000 = 2,500,000 kobo.
insert into public.exam_prices (
  examination_id, currency, amount_minor, country_codes,
  is_default, is_active, effective_from, effective_to
)
select
  e.id,
  'NGN',
  2500000,
  array['NG']::text[],
  true,
  true,
  now(),
  null
from public.examinations e
join public.programmes p on p.id = e.programme_id
where p.code in (
  'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
  'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
)
  and e.status = 'published'
on conflict (examination_id, currency) do update
set amount_minor = excluded.amount_minor,
    country_codes = excluded.country_codes,
    is_default = true,
    is_active = true,
    effective_from = least(public.exam_prices.effective_from, now()),
    effective_to = null,
    updated_at = now();

-- Abort atomically if any published target record remains incorrectly configured.
do $$
declare
  v_failure record;
begin
  select
    p.code,
    e.id,
    e.title
  into v_failure
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  left join public.exam_prices ep
    on ep.examination_id = e.id
   and ep.currency = 'NGN'
   and ep.is_default = true
   and ep.is_active = true
  where p.code in (
    'AIML', 'CYBER', 'SWEETH', 'HRMFC', 'CHRMG', 'CHRMP',
    'PM', 'PCIT', 'RMP', 'QMP', 'PCM'
  )
    and e.status = 'published'
    and (
      e.requires_payment is not true
      or e.allow_self_enrollment is not false
      or ep.id is null
      or ep.amount_minor <> 2500000
    )
  limit 1;

  if found then
    raise exception 'Payment repair failed for programme %, examination % (%).',
      v_failure.code, v_failure.id, v_failure.title;
  end if;
end;
$$;

commit;
