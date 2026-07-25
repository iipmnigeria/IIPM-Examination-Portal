begin;

create or replace function public.quote_exam_purchase(
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
  v_price public.exam_prices%rowtype;
  v_currency text := upper(trim(coalesce(nullif(p_currency, ''), 'NGN')));
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_candidate_id and role = 'candidate' and is_active = true
  ) then
    raise exception 'Only an active candidate account may request an examination quote.';
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
    select ep.* into v_price
    from public.exam_prices ep
    where ep.examination_id = p_examination_id
      and ep.currency = v_currency
      and ep.is_active = true
      and ep.effective_from <= now()
      and (ep.effective_to is null or ep.effective_to > now())
    order by ep.is_default desc, ep.effective_from desc
    limit 1;

    if not found then
      raise exception 'A price is not configured for currency %.', v_currency;
    end if;

    return jsonb_build_object(
      'examinationId', p_examination_id,
      'priceId', v_price.id,
      'currency', v_price.currency,
      'listAmountMinor', v_price.amount_minor,
      'couponId', null,
      'couponCode', null,
      'discountAmountMinor', v_price.amount_minor,
      'payableAmountMinor', 0,
      'status', 'already_unlocked',
      'canLaunch', true
    );
  end if;

  select * into v_quote
  from public.resolve_exam_purchase_quote(
    p_examination_id,
    v_candidate_id,
    v_currency,
    p_coupon_code
  );

  return jsonb_build_object(
    'examinationId', v_quote.examination_id,
    'priceId', v_quote.price_id,
    'currency', v_quote.currency,
    'listAmountMinor', v_quote.list_amount_minor,
    'couponId', v_quote.coupon_id,
    'couponCode', v_quote.coupon_code,
    'discountAmountMinor', v_quote.discount_amount_minor,
    'payableAmountMinor', v_quote.payable_amount_minor,
    'status', 'quoted',
    'canLaunch', false
  );
end;
$$;

revoke all on function public.quote_exam_purchase(uuid, text, text) from public;
grant execute on function public.quote_exam_purchase(uuid, text, text) to authenticated;

commit;
