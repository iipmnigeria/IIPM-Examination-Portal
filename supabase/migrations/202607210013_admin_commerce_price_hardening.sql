begin;

create or replace function public.admin_upsert_exam_price(
  p_examination_id uuid,
  p_currency text,
  p_amount_minor bigint,
  p_country_codes text[] default '{}'::text[],
  p_is_default boolean default false,
  p_is_active boolean default true,
  p_effective_from timestamptz default now(),
  p_effective_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_country_codes text[];
  v_price public.exam_prices%rowtype;
begin
  if not public.is_exam_admin() then
    raise exception 'Only an examination administrator or Super Administrator may manage prices.';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a valid three-letter ISO code.';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'The price must be greater than zero.';
  end if;
  if not exists (select 1 from public.examinations e where e.id = p_examination_id) then
    raise exception 'The examination was not found.';
  end if;
  if p_effective_to is not null and p_effective_to <= coalesce(p_effective_from, now()) then
    raise exception 'The price expiry must be after its effective date.';
  end if;

  select coalesce(
    array_agg(distinct upper(trim(u.code))) filter (where trim(u.code) <> ''),
    '{}'::text[]
  )
  into v_country_codes
  from unnest(coalesce(p_country_codes, '{}'::text[])) as u(code);

  if exists (
    select 1
    from unnest(v_country_codes) as country(code)
    where country.code !~ '^[A-Z]{2}$'
  ) then
    raise exception 'Country routing codes must use two-letter ISO country codes.';
  end if;

  if p_is_default and p_is_active then
    update public.exam_prices ep
    set is_default = false,
        updated_at = now()
    where ep.examination_id = p_examination_id
      and ep.currency <> v_currency
      and ep.is_default = true;
  end if;

  insert into public.exam_prices (
    examination_id, currency, amount_minor, country_codes,
    is_default, is_active, effective_from, effective_to, created_by
  ) values (
    p_examination_id,
    v_currency,
    p_amount_minor,
    v_country_codes,
    p_is_default,
    p_is_active,
    coalesce(p_effective_from, now()),
    p_effective_to,
    auth.uid()
  )
  on conflict (examination_id, currency) do update
  set amount_minor = excluded.amount_minor,
      country_codes = excluded.country_codes,
      is_default = excluded.is_default,
      is_active = excluded.is_active,
      effective_from = excluded.effective_from,
      effective_to = excluded.effective_to,
      updated_at = now()
  returning * into v_price;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'upsert_exam_price',
    'exam_price',
    v_price.id::text,
    jsonb_build_object(
      'examination_id', v_price.examination_id,
      'currency', v_price.currency,
      'amount_minor', v_price.amount_minor,
      'is_default', v_price.is_default,
      'is_active', v_price.is_active,
      'country_codes', v_price.country_codes
    )
  );

  return jsonb_build_object(
    'id', v_price.id,
    'examinationId', v_price.examination_id,
    'currency', v_price.currency,
    'amountMinor', v_price.amount_minor,
    'countryCodes', v_price.country_codes,
    'isDefault', v_price.is_default,
    'isActive', v_price.is_active,
    'effectiveFrom', v_price.effective_from,
    'effectiveTo', v_price.effective_to
  );
end;
$$;

revoke all on function public.admin_upsert_exam_price(uuid, text, bigint, text[], boolean, boolean, timestamptz, timestamptz) from public;
grant execute on function public.admin_upsert_exam_price(uuid, text, bigint, text[], boolean, boolean, timestamptz, timestamptz) to authenticated;

commit;
