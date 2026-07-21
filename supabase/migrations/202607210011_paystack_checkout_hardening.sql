begin;

create or replace function public.create_exam_order(
  p_examination_id uuid,
  p_currency text default 'NGN',
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_quote record;
  v_order public.exam_orders%rowtype;
  v_existing public.exam_orders%rowtype;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_candidate_id
      and p.role = 'candidate'
      and p.is_active = true
  ) then
    raise exception 'Only an active candidate account may create an examination order.';
  end if;

  if exists (
    select 1
    from public.exam_assignments ea
    where ea.examination_id = p_examination_id
      and ea.candidate_id = v_candidate_id
      and ea.status = 'assigned'
      and (ea.available_from is null or ea.available_from <= now())
      and (ea.expires_at is null or ea.expires_at > now())
  ) then
    return jsonb_build_object(
      'status', 'already_unlocked',
      'examinationId', p_examination_id,
      'canLaunch', true
    );
  end if;

  update public.exam_orders eo
  set status = 'expired', updated_at = now()
  where eo.candidate_id = v_candidate_id
    and eo.examination_id = p_examination_id
    and eo.status = 'pending'
    and eo.expires_at <= now();

  update public.coupon_redemptions cr
  set status = 'released', released_at = now(), updated_at = now()
  from public.exam_orders eo
  where cr.order_id = eo.id
    and eo.candidate_id = v_candidate_id
    and eo.examination_id = p_examination_id
    and eo.status = 'expired'
    and cr.status = 'reserved';

  select * into v_quote
  from public.resolve_exam_purchase_quote(
    p_examination_id,
    v_candidate_id,
    p_currency,
    p_coupon_code
  );

  if v_quote.coupon_id is not null then
    perform pg_advisory_xact_lock(hashtext(v_quote.coupon_id::text));

    select * into v_quote
    from public.resolve_exam_purchase_quote(
      p_examination_id,
      v_candidate_id,
      p_currency,
      p_coupon_code
    );
  end if;

  select * into v_existing
  from public.exam_orders eo
  where eo.candidate_id = v_candidate_id
    and eo.examination_id = p_examination_id
    and eo.currency = v_quote.currency
    and eo.price_id = v_quote.price_id
    and eo.coupon_id is not distinct from v_quote.coupon_id
    and eo.list_amount_minor = v_quote.list_amount_minor
    and eo.discount_amount_minor = v_quote.discount_amount_minor
    and eo.payable_amount_minor = v_quote.payable_amount_minor
    and eo.status = 'pending'
    and eo.expires_at > now()
  order by eo.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'orderId', v_existing.id,
      'reference', v_existing.reference,
      'examinationId', v_existing.examination_id,
      'currency', v_existing.currency,
      'listAmountMinor', v_existing.list_amount_minor,
      'discountAmountMinor', v_existing.discount_amount_minor,
      'payableAmountMinor', v_existing.payable_amount_minor,
      'status', v_existing.status,
      'authorizationUrl', v_existing.gateway_authorization_url,
      'expiresAt', v_existing.expires_at
    );
  end if;

  update public.exam_orders eo
  set status = 'cancelled', updated_at = now()
  where eo.candidate_id = v_candidate_id
    and eo.examination_id = p_examination_id
    and eo.status = 'pending';

  update public.coupon_redemptions cr
  set status = 'released', released_at = now(), updated_at = now()
  from public.exam_orders eo
  where cr.order_id = eo.id
    and eo.candidate_id = v_candidate_id
    and eo.examination_id = p_examination_id
    and eo.status = 'cancelled'
    and cr.status = 'reserved';

  insert into public.exam_orders (
    candidate_id, examination_id, price_id, coupon_id,
    currency, list_amount_minor, discount_amount_minor, payable_amount_minor,
    status, gateway, expires_at
  ) values (
    v_candidate_id,
    v_quote.examination_id,
    v_quote.price_id,
    v_quote.coupon_id,
    v_quote.currency,
    v_quote.list_amount_minor,
    v_quote.discount_amount_minor,
    v_quote.payable_amount_minor,
    case when v_quote.payable_amount_minor = 0 then 'waived' else 'pending' end,
    'paystack',
    now() + interval '30 minutes'
  ) returning * into v_order;

  if v_quote.coupon_id is not null then
    insert into public.coupon_redemptions (
      coupon_id, order_id, candidate_id, discount_amount_minor,
      status, redeemed_at
    ) values (
      v_quote.coupon_id,
      v_order.id,
      v_candidate_id,
      v_quote.discount_amount_minor,
      case when v_order.status = 'waived' then 'redeemed' else 'reserved' end,
      case when v_order.status = 'waived' then now() else null end
    );
  end if;

  if v_order.status = 'waived' then
    perform public.grant_exam_access_from_order(v_order.id);
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_candidate_id,
    'create_exam_order',
    'exam_order',
    v_order.id::text,
    jsonb_build_object(
      'reference', v_order.reference,
      'examination_id', v_order.examination_id,
      'currency', v_order.currency,
      'payable_amount_minor', v_order.payable_amount_minor,
      'status', v_order.status
    )
  );

  return jsonb_build_object(
    'orderId', v_order.id,
    'reference', v_order.reference,
    'examinationId', v_order.examination_id,
    'currency', v_order.currency,
    'listAmountMinor', v_order.list_amount_minor,
    'discountAmountMinor', v_order.discount_amount_minor,
    'payableAmountMinor', v_order.payable_amount_minor,
    'status', v_order.status,
    'canLaunch', v_order.status = 'waived',
    'expiresAt', v_order.expires_at
  );
end;
$$;

revoke all on function public.create_exam_order(uuid, text, text) from public;
grant execute on function public.create_exam_order(uuid, text, text) to authenticated;

commit;
