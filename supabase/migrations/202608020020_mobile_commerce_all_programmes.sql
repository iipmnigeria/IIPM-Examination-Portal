begin;

-- Phase M5: mobile cart commerce across every eligible examination programme.
-- Existing cart tables, child examination orders, location-routed pricing,
-- coupon reservations, Paystack verification and fulfilment remain authoritative.

create or replace function public.set_my_programme_exam_cart_item(
  p_examination_id uuid,
  p_selected boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_cart public.exam_carts%rowtype;
  v_next_position integer;
  v_changed boolean := false;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_candidate_id
      and profile.role = 'candidate'
      and profile.is_active = true
  ) then
    raise exception 'Only an active candidate account may update the examination cart.';
  end if;

  if not exists (
    select 1
    from public.examinations exam
    where exam.id = p_examination_id
      and exam.status = 'published'
      and (exam.starts_at is null or exam.starts_at <= now())
      and (exam.ends_at is null or exam.ends_at > now())
  ) then
    raise exception 'Only an available published examination may be added to this cart.';
  end if;

  v_cart := public.agilecert_get_or_create_exam_cart(v_candidate_id);

  if coalesce(p_selected, true) then
    if exists (
      select 1
      from public.exam_assignments assignment
      where assignment.examination_id = p_examination_id
        and assignment.candidate_id = v_candidate_id
        and assignment.status = 'assigned'
        and (assignment.available_from is null or assignment.available_from <= now())
        and (assignment.expires_at is null or assignment.expires_at > now())
    ) then
      raise exception 'This examination is already unlocked and cannot be added to the cart.';
    end if;

    if not exists (
      select 1
      from public.exam_cart_items item
      where item.cart_id = v_cart.id
        and item.examination_id = p_examination_id
    ) then
      perform public.agilecert_cancel_candidate_pending_bulk_orders(
        v_candidate_id,
        'mobile_cart_item_added'
      );

      update public.exam_orders child
      set status = case when child.expires_at <= now() then 'expired' else 'cancelled' end,
          metadata = coalesce(child.metadata, '{}'::jsonb) || jsonb_build_object(
            'supersededBy',
            'mobile_multi_programme_cart'
          ),
          updated_at = now()
      where child.candidate_id = v_candidate_id
        and child.examination_id = p_examination_id
        and child.status = 'pending';

      update public.coupon_redemptions redemption
      set status = 'released',
          released_at = coalesce(redemption.released_at, now()),
          updated_at = now()
      from public.exam_orders child
      where redemption.order_id = child.id
        and child.candidate_id = v_candidate_id
        and child.examination_id = p_examination_id
        and child.status in ('cancelled', 'expired')
        and redemption.status = 'reserved';

      select coalesce(max(item.position), 0) + 1
      into v_next_position
      from public.exam_cart_items item
      where item.cart_id = v_cart.id;

      insert into public.exam_cart_items(cart_id, examination_id, position)
      values (v_cart.id, p_examination_id, v_next_position);
      v_changed := true;
    end if;
  else
    if exists (
      select 1
      from public.exam_cart_items item
      where item.cart_id = v_cart.id
        and item.examination_id = p_examination_id
    ) then
      perform public.agilecert_cancel_candidate_pending_bulk_orders(
        v_candidate_id,
        'mobile_cart_item_removed'
      );

      delete from public.exam_cart_items item
      where item.cart_id = v_cart.id
        and item.examination_id = p_examination_id;
      v_changed := true;
    end if;
  end if;

  if v_changed then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (
      v_candidate_id,
      case
        when coalesce(p_selected, true) then 'add_programme_exam_cart_item'
        else 'remove_programme_exam_cart_item'
      end,
      'exam_cart',
      v_cart.id::text,
      jsonb_build_object(
        'examinationId', p_examination_id,
        'source', 'agilecert_mobile'
      )
    );
  end if;

  return public.get_my_exam_cart();
end;
$$;

create or replace function public.quote_my_programme_exam_cart(
  p_currency text,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_cart public.exam_carts%rowtype;
  v_currency text := upper(nullif(trim(coalesce(p_currency, '')), ''));
  v_coupon_code text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  v_item record;
  v_quote record;
  v_items jsonb := '[]'::jsonb;
  v_list_total bigint := 0;
  v_discount_total bigint := 0;
  v_payable_total bigint := 0;
  v_quoted_count integer := 0;
  v_unlocked_count integer := 0;
  v_coupon public.coupons%rowtype;
  v_coupon_id uuid;
  v_existing_global integer := 0;
  v_existing_candidate integer := 0;
  v_fingerprint text;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'A valid location-routed payment currency is required.';
  end if;

  perform public.configure_my_exam_cart(v_currency, v_coupon_code);

  select * into v_cart
  from public.exam_carts cart
  where cart.candidate_id = v_candidate_id;

  if not exists (
    select 1
    from public.exam_cart_items item
    where item.cart_id = v_cart.id
  ) then
    raise exception 'Select at least one eligible examination before requesting a cart quote.';
  end if;

  if v_coupon_code = 'CIPMN12-ACCESS88' and exists (
    select 1
    from public.exam_cart_items item
    join public.examinations exam on exam.id = item.examination_id
    join public.programmes programme on programme.id = exam.programme_id
    where item.cart_id = v_cart.id
      and upper(programme.code) not like 'CIPMN%'
  ) then
    raise exception 'CIPMN12-ACCESS88 applies only to eligible CIPMN examinations. Remove non-CIPMN items or remove the coupon.';
  end if;

  if v_coupon_code is not null then
    select * into v_coupon
    from public.coupons coupon
    where upper(coupon.code) = v_coupon_code;

    if found then
      if not v_coupon.is_active then
        raise exception 'This coupon is not active.';
      end if;

      if v_coupon.starts_at is not null and v_coupon.starts_at > now() then
        raise exception 'This coupon is not yet available.';
      end if;

      if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
        raise exception 'This coupon has expired.';
      end if;

      if not coalesce(v_coupon.allow_multi_module_cart, true) then
        raise exception 'This coupon is not permitted in a consolidated cart.';
      end if;

      if exists (
        select 1
        from public.exam_cart_items item
        where item.cart_id = v_cart.id
          and not public.agilecert_coupon_applies_to_examination(
            v_coupon.id,
            item.examination_id
          )
      ) then
        raise exception 'This coupon does not apply to every examination in the cart. Remove ineligible items or remove the coupon.';
      end if;
    end if;
  end if;

  select md5(
    v_candidate_id::text || '|' || v_currency || '|' || coalesce(v_coupon_code, '') || '|' ||
    coalesce(string_agg(item.examination_id::text, ',' order by item.examination_id::text), '')
  )
  into v_fingerprint
  from public.exam_cart_items item
  where item.cart_id = v_cart.id;

  for v_item in
    select
      item.position,
      exam.id as examination_id,
      exam.title,
      programme.code as programme_code
    from public.exam_cart_items item
    join public.examinations exam on exam.id = item.examination_id
    join public.programmes programme on programme.id = exam.programme_id
    where item.cart_id = v_cart.id
    order by item.position, exam.title
  loop
    if exists (
      select 1
      from public.exam_assignments assignment
      where assignment.examination_id = v_item.examination_id
        and assignment.candidate_id = v_candidate_id
        and assignment.status = 'assigned'
        and (assignment.available_from is null or assignment.available_from <= now())
        and (assignment.expires_at is null or assignment.expires_at > now())
    ) then
      v_unlocked_count := v_unlocked_count + 1;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'examinationId', v_item.examination_id,
        'examinationTitle', v_item.title,
        'programmeCode', v_item.programme_code,
        'position', v_item.position,
        'status', 'already_unlocked',
        'currency', v_currency,
        'listAmountMinor', 0,
        'discountAmountMinor', 0,
        'payableAmountMinor', 0
      ));
      continue;
    end if;

    if exists (
      select 1
      from public.agilecert_exam_pricing_policies policy
      where policy.examination_id = v_item.examination_id
        and policy.currency = v_currency
        and policy.is_active = true
        and (
          policy.access_mode <> 'paid'
          or not policy.bulk_cart_eligible
        )
    ) then
      raise exception 'The examination % requires its authorised individual access route.',
        v_item.title;
    end if;

    select * into v_quote
    from public.resolve_exam_purchase_quote(
      v_item.examination_id,
      v_candidate_id,
      v_currency,
      v_coupon_code
    );

    if upper(v_quote.currency) <> v_currency then
      raise exception 'The location-routed currency for % changed. Refresh the catalogue before continuing.',
        v_item.title;
    end if;

    if v_coupon_id is null then
      v_coupon_id := v_quote.coupon_id;
    elsif v_quote.coupon_id is distinct from v_coupon_id then
      raise exception 'The selected examinations cannot be combined under one coupon.';
    end if;

    v_quoted_count := v_quoted_count + 1;
    v_list_total := v_list_total + v_quote.list_amount_minor;
    v_discount_total := v_discount_total + v_quote.discount_amount_minor;
    v_payable_total := v_payable_total + v_quote.payable_amount_minor;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'examinationId', v_item.examination_id,
      'examinationTitle', v_item.title,
      'programmeCode', v_item.programme_code,
      'position', v_item.position,
      'status', 'quoted',
      'priceId', v_quote.price_id,
      'couponId', v_quote.coupon_id,
      'couponCode', v_quote.coupon_code,
      'currency', v_quote.currency,
      'listAmountMinor', v_quote.list_amount_minor,
      'discountAmountMinor', v_quote.discount_amount_minor,
      'payableAmountMinor', v_quote.payable_amount_minor
    ));
  end loop;

  if v_coupon_id is not null then
    select * into v_coupon
    from public.coupons coupon
    where coupon.id = v_coupon_id;

    if v_quoted_count < coalesce(v_coupon.minimum_module_count, 1) then
      raise exception 'This coupon requires at least % examinations in the cart.',
        v_coupon.minimum_module_count;
    end if;

    if v_list_total < coalesce(v_coupon.minimum_amount_minor, 0) then
      raise exception 'This cart is below the coupon minimum cart value.';
    end if;

    select count(*) into v_existing_global
    from public.coupon_redemptions redemption
    where redemption.coupon_id = v_coupon_id
      and redemption.status in ('reserved', 'redeemed');

    select count(*) into v_existing_candidate
    from public.coupon_redemptions redemption
    where redemption.coupon_id = v_coupon_id
      and redemption.candidate_id = v_candidate_id
      and redemption.status in ('reserved', 'redeemed');

    if v_coupon.maximum_redemptions is not null
       and v_existing_global + v_quoted_count > v_coupon.maximum_redemptions then
      raise exception 'This cart exceeds the remaining overall redemption allowance for the coupon.';
    end if;

    if v_existing_candidate + v_quoted_count > v_coupon.per_candidate_limit then
      raise exception 'This cart contains more coupon uses than remain available for your account.';
    end if;
  end if;

  return jsonb_build_object(
    'cartId', v_cart.id,
    'cartFingerprint', v_fingerprint,
    'currency', v_currency,
    'couponCode', v_coupon_code,
    'itemCount', jsonb_array_length(v_items),
    'quotedItemCount', v_quoted_count,
    'alreadyUnlockedCount', v_unlocked_count,
    'listAmountMinor', v_list_total,
    'discountAmountMinor', v_discount_total,
    'payableAmountMinor', v_payable_total,
    'status', case
      when v_quoted_count = 0 and v_unlocked_count > 0 then 'already_unlocked'
      when v_payable_total = 0 then 'waived'
      else 'quoted'
    end,
    'pricingRoute', 'location_routed',
    'items', v_items
  );
end;
$$;

-- Preserve the existing web cart API while allowing the established bulk-order
-- creator to consume the new all-programme quote safely.
create or replace function public.quote_my_exam_cart(
  p_currency text default 'NGN',
  p_coupon_code text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.quote_my_programme_exam_cart(p_currency, p_coupon_code);
$$;

create or replace function public.create_my_programme_exam_bulk_order(
  p_currency text,
  p_coupon_code text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.create_my_exam_bulk_order(p_currency, p_coupon_code);
$$;

revoke all on function public.set_my_programme_exam_cart_item(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.quote_my_programme_exam_cart(text, text)
  from public, anon, authenticated;
revoke all on function public.create_my_programme_exam_bulk_order(text, text)
  from public, anon, authenticated;
revoke all on function public.quote_my_exam_cart(text, text)
  from public, anon, authenticated;

grant execute on function public.set_my_programme_exam_cart_item(uuid, boolean)
  to authenticated;
grant execute on function public.quote_my_programme_exam_cart(text, text)
  to authenticated;
grant execute on function public.create_my_programme_exam_bulk_order(text, text)
  to authenticated;
grant execute on function public.quote_my_exam_cart(text, text)
  to authenticated;

comment on function public.set_my_programme_exam_cart_item(uuid, boolean) is
  'Adds or removes an eligible published examination from the authenticated candidate mobile cart without programme hard-coding.';
comment on function public.quote_my_programme_exam_cart(text, text) is
  'Returns a server-authoritative location-routed quote across eligible programmes and rejects mixed ineligible coupon scope.';
comment on function public.create_my_programme_exam_bulk_order(text, text) is
  'Creates a consolidated mobile order through the existing child-order and fulfilment authority.';

commit;
