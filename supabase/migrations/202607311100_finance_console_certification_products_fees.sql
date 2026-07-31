begin;

-- ---------------------------------------------------------------------------
-- Finance Console Phase 1B: certification products and fee administration
-- ---------------------------------------------------------------------------

insert into public.agilecert_finance_permission_definitions (
  permission_key, name, description, category, risk_level
) values (
  'finance.certificate_prices.manage',
  'Manage Certification Fees',
  'Create, edit, activate and deactivate Certificate of Achievement and Professional Certificate prices and product availability.',
  'certification_pricing',
  'sensitive'
)
on conflict (permission_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  risk_level = excluded.risk_level,
  is_active = true,
  updated_at = now();

-- Preserve the certificate-pricing capability already held by Examination
-- Administrators before Finance Console centralisation. Super Administrators
-- receive all active finance permissions implicitly.
insert into public.agilecert_finance_role_permissions (
  role, permission_key, is_granted
) values (
  'exam_admin', 'finance.certificate_prices.manage', true
)
on conflict (role, permission_key) do nothing;

create or replace function public.get_my_finance_console_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_permissions jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor and p.is_active = true;

  if v_role is null then
    raise exception 'An active portal account is required.';
  end if;

  select coalesce(jsonb_agg(d.permission_key order by d.permission_key), '[]'::jsonb)
  into v_permissions
  from public.agilecert_finance_permission_definitions d
  where d.is_active = true
    and public.agilecert_has_finance_permission(d.permission_key);

  return jsonb_build_object(
    'actorId', v_actor,
    'role', v_role,
    'permissions', v_permissions,
    'canViewConsole', public.agilecert_has_finance_permission('finance.console.view'),
    'canManageExamPrices', public.agilecert_has_finance_permission('finance.exam_prices.manage'),
    'canManageCertificatePrices', public.agilecert_has_finance_permission('finance.certificate_prices.manage'),
    'canManageCoupons', public.agilecert_has_finance_permission('finance.coupons.manage'),
    'canManageOrders', public.agilecert_has_finance_permission('finance.orders.manage'),
    'canManagePermissions', public.agilecert_has_finance_permission('finance.permissions.manage')
  );
end;
$$;

-- Compatibility authority retained for the existing Certificate Commerce
-- administration workspace. The function now obeys the dedicated Finance
-- Console permission, so it cannot bypass a permission revocation.
create or replace function public.upsert_agilecert_certificate_product_price(
  p_product_code text,
  p_currency text,
  p_early_amount_minor bigint,
  p_standard_amount_minor bigint,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_price public.agilecert_certificate_product_prices%rowtype;
begin
  if not public.agilecert_has_finance_permission('finance.certificate_prices.manage') then
    raise exception 'This account does not have permission to manage certification fees.';
  end if;

  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
  end if;

  if v_currency not in ('NGN', 'USD') then
    raise exception 'Currency must be NGN or USD.';
  end if;

  if p_early_amount_minor <= 0
     or p_standard_amount_minor < p_early_amount_minor then
    raise exception 'Standard price must be equal to or higher than the positive early price.';
  end if;

  insert into public.agilecert_certificate_product_prices (
    product_code,
    currency,
    early_amount_minor,
    standard_amount_minor,
    active,
    updated_by
  )
  values (
    v_product_code,
    v_currency,
    p_early_amount_minor,
    p_standard_amount_minor,
    coalesce(p_active, true),
    v_admin_id
  )
  on conflict (product_code, currency) do update
  set early_amount_minor = excluded.early_amount_minor,
      standard_amount_minor = excluded.standard_amount_minor,
      active = excluded.active,
      updated_by = v_admin_id,
      updated_at = now()
  returning * into v_price;

  insert into public.agilecert_certificate_commerce_audits (
    actor_id,
    action,
    metadata
  )
  values (
    v_admin_id,
    'price_updated',
    jsonb_build_object(
      'productCode', v_product_code,
      'currency', v_currency,
      'earlyAmountMinor', p_early_amount_minor,
      'standardAmountMinor', p_standard_amount_minor,
      'active', coalesce(p_active, true),
      'authority', 'finance_console_permission'
    )
  );

  return jsonb_build_object(
    'productCode', v_price.product_code,
    'currency', v_price.currency,
    'earlyAmountMinor', v_price.early_amount_minor,
    'standardAmountMinor', v_price.standard_amount_minor,
    'active', v_price.active,
    'updatedAt', v_price.updated_at
  );
end;
$$;

create or replace function public.finance_upsert_certificate_product_price(
  p_product_code text,
  p_currency text,
  p_early_amount_minor bigint,
  p_standard_amount_minor bigint,
  p_is_active boolean default true,
  p_change_reason text default 'Finance Console certification fee update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_reason text := trim(coalesce(p_change_reason, ''));
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.certificate_prices.manage') then
    raise exception 'This account does not have permission to manage certification fees.';
  end if;

  if length(v_reason) < 5 then
    raise exception 'Enter a reason of at least five characters for the certification fee change.';
  end if;

  select to_jsonb(price) into v_before
  from public.agilecert_certificate_product_prices price
  where price.product_code = v_product_code
    and price.currency = v_currency;

  v_result := public.upsert_agilecert_certificate_product_price(
    v_product_code,
    v_currency,
    p_early_amount_minor,
    p_standard_amount_minor,
    p_is_active
  );

  select to_jsonb(price) into v_after
  from public.agilecert_certificate_product_prices price
  where price.product_code = v_product_code
    and price.currency = v_currency;

  perform public.agilecert_record_finance_audit(
    v_actor,
    null,
    'certificate_price',
    v_product_code || ':' || v_currency,
    'certification_fee_saved',
    jsonb_build_object(
      'reason', v_reason,
      'before', coalesce(v_before, 'null'::jsonb),
      'after', coalesce(v_after, 'null'::jsonb)
    )
  );

  return v_result || jsonb_build_object('changeReason', v_reason);
end;
$$;

create or replace function public.finance_set_certificate_product_price_active(
  p_product_code text,
  p_currency text,
  p_is_active boolean,
  p_change_reason text default 'Finance Console certification fee status update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_reason text := trim(coalesce(p_change_reason, ''));
  v_before jsonb;
  v_after jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.certificate_prices.manage') then
    raise exception 'This account does not have permission to manage certification fees.';
  end if;

  if length(v_reason) < 5 then
    raise exception 'Enter a reason of at least five characters for the certification fee status change.';
  end if;

  select to_jsonb(price) into v_before
  from public.agilecert_certificate_product_prices price
  where price.product_code = v_product_code
    and price.currency = v_currency;

  if v_before is null then
    raise exception 'The selected certification fee was not found.';
  end if;

  update public.agilecert_certificate_product_prices
  set active = coalesce(p_is_active, false),
      updated_by = v_actor,
      updated_at = now()
  where product_code = v_product_code
    and currency = v_currency;

  select to_jsonb(price) into v_after
  from public.agilecert_certificate_product_prices price
  where price.product_code = v_product_code
    and price.currency = v_currency;

  perform public.agilecert_record_finance_audit(
    v_actor,
    null,
    'certificate_price',
    v_product_code || ':' || v_currency,
    'certification_fee_status_changed',
    jsonb_build_object(
      'reason', v_reason,
      'before', v_before,
      'after', v_after
    )
  );

  return jsonb_build_object(
    'productCode', v_product_code,
    'currency', v_currency,
    'active', coalesce(p_is_active, false),
    'changeReason', v_reason
  );
end;
$$;

create or replace function public.finance_set_certificate_product_active(
  p_product_code text,
  p_is_active boolean,
  p_change_reason text default 'Finance Console certification product status update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_reason text := trim(coalesce(p_change_reason, ''));
  v_before jsonb;
  v_after jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.certificate_prices.manage') then
    raise exception 'This account does not have permission to manage certification products.';
  end if;

  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
  end if;

  if length(v_reason) < 5 then
    raise exception 'Enter a reason of at least five characters for the certification product status change.';
  end if;

  select to_jsonb(product) into v_before
  from public.agilecert_certificate_products product
  where product.code = v_product_code;

  if v_before is null then
    raise exception 'The selected certification product was not found.';
  end if;

  update public.agilecert_certificate_products
  set active = coalesce(p_is_active, false),
      updated_at = now()
  where code = v_product_code;

  select to_jsonb(product) into v_after
  from public.agilecert_certificate_products product
  where product.code = v_product_code;

  perform public.agilecert_record_finance_audit(
    v_actor,
    null,
    'certificate_product',
    v_product_code,
    'certification_product_status_changed',
    jsonb_build_object(
      'reason', v_reason,
      'before', v_before,
      'after', v_after
    )
  );

  return jsonb_build_object(
    'productCode', v_product_code,
    'active', coalesce(p_is_active, false),
    'changeReason', v_reason
  );
end;
$$;

create or replace function public.get_finance_certification_snapshot(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_products jsonb;
  v_prices jsonb;
  v_audit jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.console.view') then
    raise exception 'This account does not have permission to view the Finance Console.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', product.code,
    'title', product.title,
    'description', product.description,
    'requiresIdentityVerification', product.requires_identity_verification,
    'includesBadge', product.includes_badge,
    'includesTranscript', product.includes_transcript,
    'active', product.active,
    'createdAt', product.created_at,
    'updatedAt', product.updated_at
  ) order by case product.code when 'achievement' then 1 else 2 end), '[]'::jsonb)
  into v_products
  from public.agilecert_certificate_products product;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productCode', price.product_code,
    'productTitle', product.title,
    'currency', price.currency,
    'earlyAmountMinor', price.early_amount_minor,
    'standardAmountMinor', price.standard_amount_minor,
    'active', price.active,
    'requiresIdentityVerification', product.requires_identity_verification,
    'updatedAt', price.updated_at
  ) order by case price.product_code when 'achievement' then 1 else 2 end, price.currency), '[]'::jsonb)
  into v_prices
  from public.agilecert_certificate_product_prices price
  join public.agilecert_certificate_products product
    on product.code = price.product_code;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', audit.id,
    'actorId', audit.actor_id,
    'actorName', profile.full_name,
    'entityType', audit.entity_type,
    'entityId', audit.entity_id,
    'action', audit.action,
    'metadata', audit.metadata,
    'createdAt', audit.created_at
  ) order by audit.created_at desc), '[]'::jsonb)
  into v_audit
  from (
    select *
    from public.agilecert_finance_audit_events
    where entity_type in ('certificate_price', 'certificate_product')
    order by created_at desc
    limit v_limit
  ) audit
  left join public.profiles profile on profile.id = audit.actor_id;

  return jsonb_build_object(
    'products', v_products,
    'prices', v_prices,
    'audit', v_audit,
    'summary', jsonb_build_object(
      'activeProducts', (
        select count(*) from public.agilecert_certificate_products where active
      ),
      'activePrices', (
        select count(*) from public.agilecert_certificate_product_prices where active
      ),
      'pendingOrders', (
        select count(*) from public.agilecert_certificate_orders
        where status in ('pending', 'initialized')
      ),
      'paidOrders', (
        select count(*) from public.agilecert_certificate_orders where status = 'paid'
      ),
      'waivedOrders', (
        select count(*) from public.agilecert_certificate_orders where status = 'waived'
      ),
      'credentials', (
        select count(*) from public.agilecert_paid_credentials
      )
    )
  );
end;
$$;

revoke all on function public.get_finance_certification_snapshot(integer)
  from public, anon, authenticated;
grant execute on function public.get_finance_certification_snapshot(integer)
  to authenticated;

revoke all on function public.finance_upsert_certificate_product_price(text, text, bigint, bigint, boolean, text)
  from public, anon, authenticated;
grant execute on function public.finance_upsert_certificate_product_price(text, text, bigint, bigint, boolean, text)
  to authenticated;

revoke all on function public.finance_set_certificate_product_price_active(text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.finance_set_certificate_product_price_active(text, text, boolean, text)
  to authenticated;

revoke all on function public.finance_set_certificate_product_active(text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.finance_set_certificate_product_active(text, boolean, text)
  to authenticated;

revoke all on function public.upsert_agilecert_certificate_product_price(text, text, bigint, bigint, boolean)
  from public, anon, authenticated;
grant execute on function public.upsert_agilecert_certificate_product_price(text, text, bigint, bigint, boolean)
  to authenticated;

comment on function public.get_finance_certification_snapshot(integer) is
  'Protected Finance Console Phase 1B snapshot for certification products, prices, summary and immutable audit evidence.';
comment on function public.finance_upsert_certificate_product_price(text, text, bigint, bigint, boolean, text) is
  'Permission-scoped certification-fee administration with immutable finance audit evidence.';
comment on function public.finance_set_certificate_product_active(text, boolean, text) is
  'Permission-scoped activation control for Certificate of Achievement and Professional Certificate products.';

notify pgrst, 'reload schema';

commit;
