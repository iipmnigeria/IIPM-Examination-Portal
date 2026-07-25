begin;

-- Activated only after the CIPMN module mock examination bank passed its
-- 12-examination / 900-question validation gate.
-- 88% discount on NGN 25,000 leaves NGN 3,000 payable per module.
-- One candidate may apply the same programme coupon once to each of the
-- twelve module examinations during the 14-day access window.

do $$
declare
  v_programme_id uuid;
  v_coupon_id uuid;
  v_starts_at timestamptz := now();
  v_expires_at timestamptz;
begin
  v_expires_at := v_starts_at + interval '14 days';

  select p.id
  into v_programme_id
  from public.programmes p
  where p.code = 'CIPMN-MOCK'
    and p.is_active = true
  limit 1;

  if v_programme_id is null then
    raise exception 'The CIPMN-MOCK programme was not found.';
  end if;

  if (
    select count(*)
    from public.examinations e
    where e.programme_id = v_programme_id
      and e.status = 'published'
  ) <> 12 then
    raise exception 'The 88%% coupon requires all 12 CIPMN mock examinations to be published.';
  end if;

  if exists (
    select 1
    from public.examinations e
    where e.programme_id = v_programme_id
      and e.status = 'published'
      and (
        select count(*)
        from public.questions q
        where q.examination_id = e.id
          and q.is_active = true
      ) <> 75
  ) then
    raise exception 'The 88%% coupon requires 75 active questions in every CIPMN module examination.';
  end if;

  select c.id
  into v_coupon_id
  from public.coupons c
  where upper(c.code) = 'CIPMN12-ACCESS88'
  limit 1
  for update;

  if v_coupon_id is null then
    insert into public.coupons (
      code,
      name,
      description,
      discount_type,
      discount_value,
      currency,
      scope,
      programme_id,
      examination_id,
      minimum_amount_minor,
      maximum_discount_minor,
      starts_at,
      expires_at,
      maximum_redemptions,
      per_candidate_limit,
      is_active,
      created_by
    ) values (
      'CIPMN12-ACCESS88',
      'CIPMN 12-Module 88% Mock Examination Access',
      'Provides an 88% discount on each of the 12 CIPMN professional licensing module mock examinations for 14 days. Limited to one redemption per module and 12 total redemptions per candidate.',
      'percentage',
      88,
      'NGN',
      'programme',
      v_programme_id,
      null,
      0,
      null,
      v_starts_at,
      v_expires_at,
      null,
      12,
      true,
      null
    )
    returning id into v_coupon_id;
  else
    update public.coupons
    set code = 'CIPMN12-ACCESS88',
        name = 'CIPMN 12-Module 88% Mock Examination Access',
        description = 'Provides an 88% discount on each of the 12 CIPMN professional licensing module mock examinations for 14 days. Limited to one redemption per module and 12 total redemptions per candidate.',
        discount_type = 'percentage',
        discount_value = 88,
        currency = 'NGN',
        scope = 'programme',
        programme_id = v_programme_id,
        examination_id = null,
        minimum_amount_minor = 0,
        maximum_discount_minor = null,
        starts_at = v_starts_at,
        expires_at = v_expires_at,
        maximum_redemptions = null,
        per_candidate_limit = 12,
        is_active = true,
        updated_at = now()
    where id = v_coupon_id;
  end if;

  if not exists (
    select 1
    from public.coupons c
    where c.id = v_coupon_id
      and upper(c.code) = 'CIPMN12-ACCESS88'
      and c.discount_type = 'percentage'
      and c.discount_value = 88
      and c.currency = 'NGN'
      and c.scope = 'programme'
      and c.programme_id = v_programme_id
      and c.examination_id is null
      and c.maximum_redemptions is null
      and c.per_candidate_limit = 12
      and c.is_active = true
      and c.expires_at = c.starts_at + interval '14 days'
  ) then
    raise exception 'The CIPMN12-ACCESS88 coupon configuration could not be verified.';
  end if;
end;
$$;

commit;
