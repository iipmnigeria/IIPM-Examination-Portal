\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '30195000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'cipmn-cart@example.test',
    extensions.crypt('CartCandidate1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"CIPMN Cart Candidate"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '30195000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'incomplete-cart@example.test',
    extensions.crypt('CartCandidate1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Incomplete Cart Candidate"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '30195000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.complete_my_agilecert_candidate_onboarding(
  'CIPMN Cart Candidate', '+2347000001950', 'NG', 'NGN', 'Africa/Lagos',
  true, true, true
);

DO $$
declare
  v_exam_1 uuid;
  v_exam_2 uuid;
  v_exam_3 uuid;
  v_single jsonb;
  v_single_order_id uuid;
  v_cart jsonb;
  v_quote jsonb;
  v_first_bulk jsonb;
  v_second_bulk jsonb;
  v_reused_bulk jsonb;
  v_first_bulk_id uuid;
  v_second_bulk_id uuid;
begin
  select e.id into v_exam_1
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where p.code = 'CIPMN-MOCK' and e.title like 'CIPMN-MOD-001 - %';

  select e.id into v_exam_2
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where p.code = 'CIPMN-MOCK' and e.title like 'CIPMN-MOD-002 - %';

  select e.id into v_exam_3
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where p.code = 'CIPMN-MOCK' and e.title like 'CIPMN-MOD-003 - %';

  if v_exam_1 is null or v_exam_2 is null or v_exam_3 is null then
    raise exception 'The three required CIPMN module examinations were not found.';
  end if;

  -- Selecting a module for the cart supersedes an uncompleted individual order.
  v_single := public.create_exam_order(v_exam_1, 'NGN', 'CIPMN12-ACCESS88');
  v_single_order_id := (v_single ->> 'orderId')::uuid;
  if v_single ->> 'status' <> 'pending' then
    raise exception 'Expected a pending single-module order before cart selection: %', v_single;
  end if;

  v_cart := public.set_my_exam_cart_item(v_exam_1, true);
  if (v_cart ->> 'itemCount')::integer <> 1 then
    raise exception 'The first module was not added to the cart: %', v_cart;
  end if;
  if not exists (
    select 1 from public.exam_orders o
    where o.id = v_single_order_id and o.status = 'cancelled'
  ) then
    raise exception 'The superseded single-module order was not cancelled.';
  end if;
  if exists (
    select 1 from public.coupon_redemptions r
    where r.order_id = v_single_order_id and r.status = 'reserved'
  ) then
    raise exception 'The superseded single-module coupon reservation was not released.';
  end if;

  v_cart := public.set_my_exam_cart_item(v_exam_2, true);
  v_quote := public.quote_my_exam_cart('NGN', 'CIPMN12-ACCESS88');
  if (v_quote ->> 'quotedItemCount')::integer <> 2
     or (v_quote ->> 'listAmountMinor')::bigint <> 5000000
     or (v_quote ->> 'discountAmountMinor')::bigint <> 4400000
     or (v_quote ->> 'payableAmountMinor')::bigint <> 600000 then
    raise exception 'The two-module cart quote is incorrect: %', v_quote;
  end if;

  v_first_bulk := public.create_my_exam_bulk_order('NGN', 'CIPMN12-ACCESS88');
  v_first_bulk_id := (v_first_bulk ->> 'bulkOrderId')::uuid;
  if v_first_bulk ->> 'status' <> 'pending'
     or (v_first_bulk ->> 'itemCount')::integer <> 2
     or (v_first_bulk ->> 'payableAmountMinor')::bigint <> 600000 then
    raise exception 'The initial consolidated order is incorrect: %', v_first_bulk;
  end if;
  if (select count(*) from public.exam_bulk_order_items where bulk_order_id = v_first_bulk_id) <> 2 then
    raise exception 'The initial consolidated order did not create two item allocations.';
  end if;

  -- Changing the cart cancels the prior parent and releases its child reservations.
  v_cart := public.set_my_exam_cart_item(v_exam_3, true);
  if (v_cart ->> 'itemCount')::integer <> 3 then
    raise exception 'The third module was not added to the cart: %', v_cart;
  end if;
  if not exists (
    select 1 from public.exam_bulk_orders b
    where b.id = v_first_bulk_id and b.status = 'cancelled'
  ) then
    raise exception 'The superseded consolidated order was not cancelled.';
  end if;
  if exists (
    select 1
    from public.coupon_redemptions r
    join public.exam_bulk_order_items i on i.child_order_id = r.order_id
    where i.bulk_order_id = v_first_bulk_id and r.status = 'reserved'
  ) then
    raise exception 'Coupon reservations from the cancelled consolidated order remain active.';
  end if;

  v_quote := public.quote_my_exam_cart('NGN', 'CIPMN12-ACCESS88');
  if (v_quote ->> 'quotedItemCount')::integer <> 3
     or (v_quote ->> 'listAmountMinor')::bigint <> 7500000
     or (v_quote ->> 'discountAmountMinor')::bigint <> 6600000
     or (v_quote ->> 'payableAmountMinor')::bigint <> 900000 then
    raise exception 'The three-module cart quote is incorrect: %', v_quote;
  end if;

  v_second_bulk := public.create_my_exam_bulk_order('NGN', 'CIPMN12-ACCESS88');
  v_second_bulk_id := (v_second_bulk ->> 'bulkOrderId')::uuid;
  if v_second_bulk ->> 'status' <> 'pending'
     or (v_second_bulk ->> 'itemCount')::integer <> 3
     or (v_second_bulk ->> 'payableAmountMinor')::bigint <> 900000 then
    raise exception 'The final consolidated order is incorrect: %', v_second_bulk;
  end if;

  v_reused_bulk := public.create_my_exam_bulk_order('NGN', 'CIPMN12-ACCESS88');
  if (v_reused_bulk ->> 'bulkOrderId')::uuid <> v_second_bulk_id then
    raise exception 'Identical repeated checkout did not reuse the active parent order.';
  end if;
  if (select count(*) from public.exam_bulk_orders where id = v_second_bulk_id) <> 1
     or (select count(*) from public.exam_bulk_order_items where bulk_order_id = v_second_bulk_id) <> 3 then
    raise exception 'Repeated checkout created duplicate parent or item rows.';
  end if;
end;
$$;

-- Fulfil through the same protected authority used by the Paystack verifier/webhook.
select set_config('request.jwt.claim.role', 'service_role', true);

DO $$
declare
  v_bulk_id uuid;
  v_result jsonb;
  v_duplicate jsonb;
begin
  select b.id into v_bulk_id
  from public.exam_bulk_orders b
  where b.candidate_id = '30195000-0000-0000-0000-000000000001'
    and b.status = 'pending'
  order by b.created_at desc
  limit 1;

  v_result := public.fulfil_paid_exam_bulk_order(
    v_bulk_id,
    '19500001',
    jsonb_build_object(
      'id', 19500001,
      'reference', (select reference from public.exam_bulk_orders where id = v_bulk_id),
      'status', 'success',
      'currency', 'NGN',
      'requested_amount', 900000,
      'validation', 'cipmn_multi_module_cart'
    )
  );

  if v_result ->> 'status' <> 'fulfilled'
     or (v_result ->> 'itemCount')::integer <> 3 then
    raise exception 'The consolidated order was not fully fulfilled: %', v_result;
  end if;

  v_duplicate := public.fulfil_paid_exam_bulk_order(
    v_bulk_id,
    '19500001',
    jsonb_build_object('validation', 'duplicate_bulk_fulfilment')
  );
  if v_duplicate ->> 'status' <> 'fulfilled' then
    raise exception 'Idempotent repeated fulfilment did not return the fulfilled order.';
  end if;

  if (select count(*) from public.exam_bulk_payments where bulk_order_id = v_bulk_id and status = 'success') <> 1 then
    raise exception 'The parent Paystack payment was not recorded exactly once.';
  end if;
  if (select count(*) from public.exam_bulk_order_items where bulk_order_id = v_bulk_id and status = 'fulfilled') <> 3 then
    raise exception 'Not all child item allocations were fulfilled.';
  end if;
  if (select count(*) from public.exam_payments p
      join public.exam_bulk_order_items i on i.child_order_id = p.order_id
      where i.bulk_order_id = v_bulk_id and p.status = 'success') <> 3 then
    raise exception 'The existing child payment ledger was not preserved for all modules.';
  end if;
  if (select count(*) from public.exam_assignments a
      join public.exam_bulk_order_items i on i.examination_id = a.examination_id
      where i.bulk_order_id = v_bulk_id
        and a.candidate_id = '30195000-0000-0000-0000-000000000001'
        and a.status = 'assigned') <> 3 then
    raise exception 'The three purchased modules were not assigned to the candidate.';
  end if;
  if exists (
    select 1 from public.exam_cart_items ci
    join public.exam_carts c on c.id = ci.cart_id
    where c.candidate_id = '30195000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Successfully fulfilled modules were not removed from the active cart.';
  end if;
end;
$$;

-- An incomplete candidate may prepare a cart but cannot create a purchase order.
select set_config('request.jwt.claim.sub', '30195000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
declare
  v_exam_id uuid;
begin
  select e.id into v_exam_id
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where p.code = 'CIPMN-MOCK' and e.title like 'CIPMN-MOD-004 - %';

  perform public.set_my_exam_cart_item(v_exam_id, true);

  begin
    perform public.create_my_exam_bulk_order('NGN', 'CIPMN12-ACCESS88');
    raise exception 'An incomplete candidate incorrectly created a consolidated order.';
  exception
    when others then
      if position('mandatory candidate profile' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- Candidate-owned RPCs never expose another candidate's order history.
DO $$
declare
  v_history jsonb;
begin
  v_history := public.get_my_exam_bulk_orders();
  if jsonb_array_length(v_history -> 'orders') <> 0 then
    raise exception 'A candidate accessed another candidate''s consolidated order history.';
  end if;
end;
$$;

DO $$
begin
  if has_table_privilege('authenticated', 'public.exam_carts', 'select')
     or has_table_privilege('authenticated', 'public.exam_cart_items', 'select')
     or has_table_privilege('authenticated', 'public.exam_bulk_orders', 'select')
     or has_table_privilege('authenticated', 'public.exam_bulk_order_items', 'select')
     or has_table_privilege('authenticated', 'public.exam_bulk_payments', 'select') then
    raise exception 'Direct authenticated table privileges expose protected cart or payment data.';
  end if;
end;
$$;

select
  (select count(*) from public.exam_bulk_orders where status = 'fulfilled') as fulfilled_bulk_orders,
  (select count(*) from public.exam_bulk_order_items where status = 'fulfilled') as fulfilled_bulk_items,
  (select count(*) from public.exam_bulk_payments where status = 'success') as consolidated_payments,
  (select count(*) from public.exam_assignments
   where candidate_id = '30195000-0000-0000-0000-000000000001' and status = 'assigned') as assigned_modules,
  (select count(*) from public.coupon_redemptions
   where candidate_id = '30195000-0000-0000-0000-000000000001' and status = 'redeemed') as redeemed_coupon_items;

rollback;
