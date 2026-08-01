begin;

-- ---------------------------------------------------------------------------
-- Finance Console production commissioning hotfix
--
-- PostgreSQL rejects the original coupon-performance JSON expression because
-- count() and sum() were nested directly inside jsonb_agg(). Aggregate coupon
-- metrics in a derived table first, then build the JSON array from those
-- scalar values. No checkout, order, payment, entitlement or pricing authority
-- is changed by this migration.
-- ---------------------------------------------------------------------------

create or replace function public.finance_coupon_performance_snapshot(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'couponCode', grouped.coupon_code,
        'redemptions', grouped.redemptions,
        'discountAmountMinor', grouped.discount_amount_minor,
        'maximumRedemptions', grouped.maximum_redemptions,
        'remainingRedemptions', grouped.remaining_redemptions
      )
      order by grouped.discount_amount_minor desc, grouped.coupon_code
    ),
    '[]'::jsonb
  )
  from (
    select
      upper(coupon.code) as coupon_code,
      count(redemption.id)::integer as redemptions,
      coalesce(sum(redemption.discount_amount_minor), 0)::bigint as discount_amount_minor,
      coupon.maximum_redemptions,
      case
        when coupon.maximum_redemptions is null then null
        else greatest(
          coupon.maximum_redemptions - count(redemption.id)::integer,
          0
        )
      end as remaining_redemptions
    from public.coupons coupon
    left join public.coupon_redemptions redemption
      on redemption.coupon_id = coupon.id
     and redemption.status = 'redeemed'
     and redemption.created_at between p_from and p_to
    group by coupon.id, coupon.code, coupon.maximum_redemptions
  ) grouped;
$$;

comment on function public.finance_coupon_performance_snapshot(timestamptz, timestamptz) is
  'Returns coupon redemption and discount metrics after aggregating each coupon before JSON construction.';

revoke all on function public.finance_coupon_performance_snapshot(timestamptz, timestamptz)
  from public, anon, authenticated;

-- Patch only the defective coupon-performance expression in the previously
-- validated snapshot RPC. Using the live function definition avoids copying or
-- altering the remaining transaction, receipt, dashboard and authority logic.
do $patch$
declare
  v_definition text;
  v_start_marker constant text := $marker$'couponPerformance', coalesce(($marker$;
  v_end_marker constant text := $marker$      'dailyPerformance', coalesce(($marker$;
  v_start integer;
  v_end integer;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.get_finance_console_completion_snapshot(integer,timestamptz,timestamptz)'::regprocedure
  ) into v_definition;

  v_start := strpos(v_definition, v_start_marker);
  v_end := strpos(v_definition, v_end_marker);

  if v_start = 0 or v_end = 0 or v_end <= v_start then
    raise exception 'The expected Finance Console coupon-performance block was not found.';
  end if;

  v_patched :=
    left(v_definition, v_start - 1)
    || $replacement$'couponPerformance', public.finance_coupon_performance_snapshot(v_from, v_to),
$replacement$
    || substring(v_definition from v_end);

  execute v_patched;
end;
$patch$;

-- Preserve the existing authenticated snapshot boundary and keep the helper
-- inaccessible as a standalone browser RPC.
revoke all on function public.get_finance_console_completion_snapshot(integer,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_finance_console_completion_snapshot(integer,timestamptz,timestamptz)
  to authenticated;

-- Migration-time structural assertions.
do $verify$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.get_finance_console_completion_snapshot(integer,timestamptz,timestamptz)'::regprocedure
  ) into v_definition;

  if position(
    'public.finance_coupon_performance_snapshot(v_from, v_to)'
    in v_definition
  ) = 0 then
    raise exception 'The Finance Console snapshot does not call the corrected coupon helper.';
  end if;

  if position(
    $$'couponCode',upper(coupon.code),'redemptions',count(redemption.id)$$
    in v_definition
  ) > 0 then
    raise exception 'The nested coupon aggregate expression is still present.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'finance_coupon_performance_snapshot'
      and p.prosecdef = true
  ) then
    raise exception 'The corrected coupon-performance helper is missing or not security definer.';
  end if;
end;
$verify$;

commit;
