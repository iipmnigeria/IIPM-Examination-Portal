begin;

-- Restore legacy commerce RPCs only where production drift removed them.
-- Finance Console Phase 1 immediately revokes browser execution and exposes
-- permission-specific wrappers, so these functions remain internal bridges.

create or replace function public.get_admin_commerce_snapshot(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if not public.is_exam_admin() then
    raise exception 'Only an examination administrator or Super Administrator may access commerce controls.';
  end if;

  return jsonb_build_object(
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'publishedExaminations', (select count(*) from public.examinations where status = 'published'),
      'activePrices', (select count(*) from public.exam_prices where is_active),
      'activeCoupons', (select count(*) from public.coupons where is_active),
      'pendingOrders', (select count(*) from public.exam_orders where status = 'pending'),
      'paidOrders', (select count(*) from public.exam_orders where status = 'paid'),
      'waivedOrders', (select count(*) from public.exam_orders where status = 'waived'),
      'failedOrders', (select count(*) from public.exam_orders where status in ('failed','cancelled','expired')),
      'paidByCurrency', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', currency,
          'amountMinor', amount_minor,
          'transactions', transaction_count
        ) order by currency)
        from (
          select currency, coalesce(sum(payable_amount_minor),0)::bigint amount_minor,
                 count(*)::integer transaction_count
          from public.exam_orders where status = 'paid' group by currency
        ) paid
      ), '[]'::jsonb)
    ),
    'examinations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'programmeId', p.id,
        'course', p.code,
        'title', e.title,
        'status', e.status,
        'requiresPayment', e.requires_payment,
        'prices', coalesce((select jsonb_agg(jsonb_build_object(
          'id', ep.id,
          'currency', ep.currency,
          'amountMinor', ep.amount_minor,
          'countryCodes', ep.country_codes,
          'isDefault', ep.is_default,
          'isActive', ep.is_active,
          'effectiveFrom', ep.effective_from,
          'effectiveTo', ep.effective_to,
          'updatedAt', ep.updated_at
        ) order by ep.is_default desc, ep.currency)
        from public.exam_prices ep where ep.examination_id = e.id), '[]'::jsonb)
      ) order by p.code, e.title)
      from public.examinations e join public.programmes p on p.id = e.programme_id
      where e.status <> 'archived'
    ), '[]'::jsonb),
    'programmes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'code', p.code, 'name', p.name, 'isActive', p.is_active
    ) order by p.code) from public.programmes p), '[]'::jsonb),
    'coupons', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'code', upper(c.code), 'name', c.name,
      'description', c.description, 'discountType', c.discount_type,
      'discountValue', c.discount_value, 'currency', c.currency,
      'scope', c.scope, 'programmeId', c.programme_id,
      'examinationId', c.examination_id,
      'minimumAmountMinor', c.minimum_amount_minor,
      'maximumDiscountMinor', c.maximum_discount_minor,
      'startsAt', c.starts_at, 'expiresAt', c.expires_at,
      'maximumRedemptions', c.maximum_redemptions,
      'perCandidateLimit', c.per_candidate_limit,
      'isActive', c.is_active,
      'reservedCount', (select count(*) from public.coupon_redemptions cr where cr.coupon_id = c.id and cr.status = 'reserved'),
      'redeemedCount', (select count(*) from public.coupon_redemptions cr where cr.coupon_id = c.id and cr.status = 'redeemed'),
      'createdAt', c.created_at, 'updatedAt', c.updated_at
    ) order by c.created_at desc) from public.coupons c), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(payload order by payload ->> 'createdAt' desc) from (
      select jsonb_build_object(
        'id', eo.id, 'reference', eo.reference, 'candidateId', eo.candidate_id,
        'candidateName', pr.full_name, 'candidateEmail', pr.email,
        'examinationId', eo.examination_id, 'course', p.code,
        'examinationTitle', e.title,
        'couponCode', case when c.id is null then null else upper(c.code) end,
        'currency', eo.currency, 'listAmountMinor', eo.list_amount_minor,
        'discountAmountMinor', eo.discount_amount_minor,
        'payableAmountMinor', eo.payable_amount_minor, 'status', eo.status,
        'gateway', eo.gateway, 'expiresAt', eo.expires_at,
        'paidAt', eo.paid_at, 'fulfilledAt', eo.fulfilled_at,
        'createdAt', eo.created_at, 'updatedAt', eo.updated_at
      ) payload
      from public.exam_orders eo
      join public.profiles pr on pr.id = eo.candidate_id
      join public.examinations e on e.id = eo.examination_id
      join public.programmes p on p.id = e.programme_id
      left join public.coupons c on c.id = eo.coupon_id
      order by eo.created_at desc limit v_limit
    ) q), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(payload order by payload ->> 'createdAt' desc) from (
      select jsonb_build_object(
        'id', pay.id, 'orderId', pay.order_id, 'reference', pay.reference,
        'provider', pay.provider, 'providerTransactionId', pay.provider_transaction_id,
        'candidateName', pr.full_name, 'candidateEmail', pr.email,
        'course', p.code, 'examinationTitle', e.title,
        'status', pay.status, 'amountMinor', pay.amount_minor,
        'currency', pay.currency, 'paidAt', pay.paid_at,
        'createdAt', pay.created_at, 'updatedAt', pay.updated_at
      ) payload
      from public.exam_payments pay
      join public.exam_orders eo on eo.id = pay.order_id
      join public.profiles pr on pr.id = eo.candidate_id
      join public.examinations e on e.id = eo.examination_id
      join public.programmes p on p.id = e.programme_id
      order by pay.created_at desc limit v_limit
    ) q), '[]'::jsonb),
    'redemptions', '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_upsert_exam_price(
  p_examination_id uuid, p_currency text, p_amount_minor bigint,
  p_country_codes text[] default '{}'::text[], p_is_default boolean default false,
  p_is_active boolean default true, p_effective_from timestamptz default now(),
  p_effective_to timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_price public.exam_prices%rowtype; v_currency text := upper(trim(p_currency));
begin
  if not public.is_exam_admin() then raise exception 'Only an examination administrator or Super Administrator may manage prices.'; end if;
  if v_currency !~ '^[A-Z]{3}$' or p_amount_minor <= 0 then raise exception 'A valid currency and positive price are required.'; end if;
  if p_is_default and p_is_active then
    update public.exam_prices set is_default = false, updated_at = now()
    where examination_id = p_examination_id and currency <> v_currency and is_default;
  end if;
  insert into public.exam_prices(examination_id,currency,amount_minor,country_codes,is_default,is_active,effective_from,effective_to,created_by)
  values(p_examination_id,v_currency,p_amount_minor,coalesce(p_country_codes,'{}'::text[]),p_is_default,p_is_active,coalesce(p_effective_from,now()),p_effective_to,auth.uid())
  on conflict(examination_id,currency) do update set
    amount_minor=excluded.amount_minor,country_codes=excluded.country_codes,
    is_default=excluded.is_default,is_active=excluded.is_active,
    effective_from=excluded.effective_from,effective_to=excluded.effective_to,updated_at=now()
  returning * into v_price;
  return jsonb_build_object('id',v_price.id,'examinationId',v_price.examination_id,'currency',v_price.currency,'amountMinor',v_price.amount_minor,'countryCodes',v_price.country_codes,'isDefault',v_price.is_default,'isActive',v_price.is_active,'effectiveFrom',v_price.effective_from,'effectiveTo',v_price.effective_to);
end; $$;

create or replace function public.admin_set_exam_price_active(p_price_id uuid,p_is_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_price public.exam_prices%rowtype;
begin
  if not public.is_exam_admin() then raise exception 'Only an examination administrator or Super Administrator may manage prices.'; end if;
  update public.exam_prices set is_active=coalesce(p_is_active,false),updated_at=now() where id=p_price_id returning * into v_price;
  if v_price.id is null then raise exception 'The examination price was not found.'; end if;
  return jsonb_build_object('id',v_price.id,'isActive',v_price.is_active);
end; $$;

create or replace function public.admin_set_coupon_active(p_coupon_id uuid,p_is_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coupon public.coupons%rowtype;
begin
  if not public.is_exam_admin() then raise exception 'Only an examination administrator or Super Administrator may manage coupons.'; end if;
  update public.coupons set is_active=coalesce(p_is_active,false),updated_at=now() where id=p_coupon_id returning * into v_coupon;
  if v_coupon.id is null then raise exception 'The coupon was not found.'; end if;
  return jsonb_build_object('id',v_coupon.id,'isActive',v_coupon.is_active);
end; $$;

create or replace function public.admin_cancel_exam_order(p_order_id uuid,p_reason text default 'Cancelled by administrator')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.exam_orders%rowtype;
begin
  if not public.is_exam_admin() then raise exception 'Only an examination administrator or Super Administrator may manage orders.'; end if;
  update public.exam_orders set status='cancelled',updated_at=now()
  where id=p_order_id and status in ('pending','failed','expired') returning * into v_order;
  if v_order.id is null then raise exception 'Only eligible unpaid orders may be cancelled.'; end if;
  return jsonb_build_object('id',v_order.id,'status',v_order.status,'reason',trim(coalesce(p_reason,'')));
end; $$;

-- Coupon creation is restored from the existing authoritative table contract.
create or replace function public.admin_upsert_coupon(
  p_coupon_id uuid default null, p_code text default null, p_name text default null,
  p_description text default null, p_discount_type text default 'percentage',
  p_discount_value numeric default 0, p_currency text default null,
  p_scope text default 'all', p_programme_id uuid default null,
  p_examination_id uuid default null, p_minimum_amount_minor bigint default 0,
  p_maximum_discount_minor bigint default null, p_starts_at timestamptz default null,
  p_expires_at timestamptz default null, p_maximum_redemptions integer default null,
  p_per_candidate_limit integer default 1, p_is_active boolean default true
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coupon public.coupons%rowtype; v_code text := upper(trim(coalesce(p_code,'')));
begin
  if not public.is_exam_admin() then raise exception 'Only an examination administrator or Super Administrator may manage coupons.'; end if;
  if v_code !~ '^[A-Z0-9_-]{3,40}$' then raise exception 'Coupon code is invalid.'; end if;
  if p_discount_type not in ('percentage','fixed') or p_discount_value <= 0 then raise exception 'Discount configuration is invalid.'; end if;
  if p_coupon_id is null then
    insert into public.coupons(code,name,description,discount_type,discount_value,currency,scope,programme_id,examination_id,minimum_amount_minor,maximum_discount_minor,starts_at,expires_at,maximum_redemptions,per_candidate_limit,is_active,created_by)
    values(v_code,nullif(trim(coalesce(p_name,'')),''),nullif(trim(coalesce(p_description,'')),''),p_discount_type,p_discount_value,nullif(upper(trim(coalesce(p_currency,''))),''),p_scope,p_programme_id,p_examination_id,coalesce(p_minimum_amount_minor,0),p_maximum_discount_minor,p_starts_at,p_expires_at,p_maximum_redemptions,greatest(coalesce(p_per_candidate_limit,1),1),coalesce(p_is_active,true),auth.uid())
    returning * into v_coupon;
  else
    update public.coupons set code=v_code,name=nullif(trim(coalesce(p_name,'')),''),description=nullif(trim(coalesce(p_description,'')),''),discount_type=p_discount_type,discount_value=p_discount_value,currency=nullif(upper(trim(coalesce(p_currency,''))),''),scope=p_scope,programme_id=p_programme_id,examination_id=p_examination_id,minimum_amount_minor=coalesce(p_minimum_amount_minor,0),maximum_discount_minor=p_maximum_discount_minor,starts_at=p_starts_at,expires_at=p_expires_at,maximum_redemptions=p_maximum_redemptions,per_candidate_limit=greatest(coalesce(p_per_candidate_limit,1),1),is_active=coalesce(p_is_active,true),updated_at=now()
    where id=p_coupon_id returning * into v_coupon;
  end if;
  if v_coupon.id is null then raise exception 'The coupon was not found.'; end if;
  return jsonb_build_object('id',v_coupon.id,'code',upper(v_coupon.code),'isActive',v_coupon.is_active);
end; $$;

revoke all on function public.get_admin_commerce_snapshot(integer) from public, anon;
revoke all on function public.admin_upsert_exam_price(uuid,text,bigint,text[],boolean,boolean,timestamptz,timestamptz) from public, anon;
revoke all on function public.admin_set_exam_price_active(uuid,boolean) from public, anon;
revoke all on function public.admin_upsert_coupon(uuid,text,text,text,text,numeric,text,text,uuid,uuid,bigint,bigint,timestamptz,timestamptz,integer,integer,boolean) from public, anon;
revoke all on function public.admin_set_coupon_active(uuid,boolean) from public, anon;
revoke all on function public.admin_cancel_exam_order(uuid,text) from public, anon;

grant execute on function public.get_admin_commerce_snapshot(integer) to authenticated;
grant execute on function public.admin_upsert_exam_price(uuid,text,bigint,text[],boolean,boolean,timestamptz,timestamptz) to authenticated;
grant execute on function public.admin_set_exam_price_active(uuid,boolean) to authenticated;
grant execute on function public.admin_upsert_coupon(uuid,text,text,text,text,numeric,text,text,uuid,uuid,bigint,bigint,timestamptz,timestamptz,integer,integer,boolean) to authenticated;
grant execute on function public.admin_set_coupon_active(uuid,boolean) to authenticated;
grant execute on function public.admin_cancel_exam_order(uuid,text) to authenticated;

commit;
