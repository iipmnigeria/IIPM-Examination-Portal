\set ON_ERROR_STOP on

begin;

do $test$
declare
  v_payload jsonb;
  v_definition text;
begin
  if to_regprocedure(
    'public.finance_coupon_performance_snapshot(timestamp with time zone,timestamp with time zone)'
  ) is null then
    raise exception 'The corrected coupon-performance helper is missing.';
  end if;

  v_payload := public.finance_coupon_performance_snapshot(
    now() - interval '90 days',
    now()
  );

  if jsonb_typeof(v_payload) <> 'array' then
    raise exception 'Coupon performance must return a JSON array: %', v_payload;
  end if;

  select pg_get_functiondef(
    'public.get_finance_console_completion_snapshot(integer,timestamptz,timestamptz)'::regprocedure
  ) into v_definition;

  if position(
    'public.finance_coupon_performance_snapshot(v_from, v_to)'
    in v_definition
  ) = 0 then
    raise exception 'The Finance Console snapshot is not using the corrected coupon helper.';
  end if;

  if position(
    $$'couponCode',upper(coupon.code),'redemptions',count(redemption.id)$$
    in v_definition
  ) > 0 then
    raise exception 'The invalid nested coupon aggregate remains in the snapshot function.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.finance_coupon_performance_snapshot(timestamptz,timestamptz)',
    'execute'
  ) then
    raise exception 'The internal coupon helper must not be directly executable by authenticated users.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_finance_console_completion_snapshot(integer,timestamptz,timestamptz)',
    'execute'
  ) then
    raise exception 'Authenticated Finance Console snapshot access was not preserved.';
  end if;
end;
$test$;

select jsonb_build_object(
  'helperReturnedArray', true,
  'snapshotUsesPreaggregatedCoupons', true,
  'browserHelperAccessDenied', true,
  'snapshotAggregateFixVerified', true
) as finance_console_snapshot_coupon_fix;

rollback;
