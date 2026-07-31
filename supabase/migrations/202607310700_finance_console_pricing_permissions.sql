begin;

-- ---------------------------------------------------------------------------
-- Finance Console Phase 1: permission foundation and protected fee controls
-- ---------------------------------------------------------------------------

create table if not exists public.agilecert_finance_permission_definitions (
  permission_key text primary key check (permission_key ~ '^finance\.[a-z0-9_.-]+$'),
  name text not null,
  description text not null,
  category text not null default 'finance_console',
  risk_level text not null default 'standard'
    check (risk_level in ('standard', 'sensitive', 'restricted')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_finance_role_permissions (
  role text not null check (role in ('auditor', 'exam_admin')),
  permission_key text not null references public.agilecert_finance_permission_definitions(permission_key) on delete cascade,
  is_granted boolean not null default true,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create trigger agilecert_finance_permission_definitions_set_updated_at
  before update on public.agilecert_finance_permission_definitions
  for each row execute function public.set_updated_at();

create trigger agilecert_finance_role_permissions_set_updated_at
  before update on public.agilecert_finance_role_permissions
  for each row execute function public.set_updated_at();

insert into public.agilecert_finance_permission_definitions (
  permission_key, name, description, category, risk_level
) values
  ('finance.console.view', 'View Finance Console', 'Open the Finance Console and view configured examination fees and finance summaries.', 'finance_console', 'standard'),
  ('finance.exam_prices.manage', 'Manage Examination Fees', 'Create, edit, activate and deactivate examination prices and currency routing.', 'examination_pricing', 'sensitive'),
  ('finance.coupons.manage', 'Manage Discount Codes', 'Create, edit, activate and deactivate examination discount codes.', 'discounts', 'sensitive'),
  ('finance.orders.manage', 'Manage Examination Orders', 'Review and cancel eligible examination payment orders.', 'orders', 'sensitive'),
  ('finance.permissions.manage', 'Manage Finance Permissions', 'Grant or revoke Finance Console permissions for examination administrators.', 'permissions', 'restricted')
on conflict (permission_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  risk_level = excluded.risk_level,
  is_active = true,
  updated_at = now();

-- Preserve existing examination-administrator capability during the transition.
insert into public.agilecert_finance_role_permissions (
  role, permission_key, is_granted
)
select 'exam_admin', permission_key, true
from public.agilecert_finance_permission_definitions
where permission_key in (
  'finance.console.view',
  'finance.exam_prices.manage',
  'finance.coupons.manage',
  'finance.orders.manage'
)
on conflict (role, permission_key) do nothing;

create or replace function public.agilecert_has_finance_permission(
  p_permission_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_permission text := lower(trim(coalesce(p_permission_key, '')));
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return true;
  end if;

  if v_actor is null or v_permission = '' then
    return false;
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor and p.is_active = true;

  if v_role is null then
    return false;
  end if;

  if v_role = 'super_admin' then
    return exists (
      select 1
      from public.agilecert_finance_permission_definitions d
      where d.permission_key = v_permission and d.is_active = true
    );
  end if;

  return exists (
    select 1
    from public.agilecert_finance_role_permissions rp
    join public.agilecert_finance_permission_definitions d
      on d.permission_key = rp.permission_key
    where rp.role = v_role
      and rp.permission_key = v_permission
      and rp.is_granted = true
      and d.is_active = true
  );
end;
$$;

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
    'canManageCoupons', public.agilecert_has_finance_permission('finance.coupons.manage'),
    'canManageOrders', public.agilecert_has_finance_permission('finance.orders.manage'),
    'canManagePermissions', public.agilecert_has_finance_permission('finance.permissions.manage')
  );
end;
$$;

create or replace function public.admin_set_finance_role_permission(
  p_role text,
  p_permission_key text,
  p_is_granted boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text := public.current_user_role();
  v_role text := lower(trim(coalesce(p_role, '')));
  v_permission text := lower(trim(coalesce(p_permission_key, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_previous boolean;
begin
  if v_actor is null or v_actor_role <> 'super_admin' then
    raise exception 'Only a Super Administrator may manage finance permissions.';
  end if;

  if v_role <> 'exam_admin' then
    raise exception 'Phase 1 finance permissions may only be assigned to the examination administrator role.';
  end if;

  if v_permission = 'finance.permissions.manage' then
    raise exception 'Finance permission administration remains restricted to Super Administrators.';
  end if;

  if not exists (
    select 1 from public.agilecert_finance_permission_definitions
    where permission_key = v_permission and is_active = true
  ) then
    raise exception 'The selected finance permission was not found.';
  end if;

  if length(v_reason) < 5 then
    raise exception 'Enter a reason of at least five characters for the permission change.';
  end if;

  select rp.is_granted into v_previous
  from public.agilecert_finance_role_permissions rp
  where rp.role = v_role and rp.permission_key = v_permission;

  insert into public.agilecert_finance_role_permissions (
    role, permission_key, is_granted, updated_by
  ) values (
    v_role, v_permission, coalesce(p_is_granted, false), v_actor
  )
  on conflict (role, permission_key) do update set
    is_granted = excluded.is_granted,
    updated_by = excluded.updated_by,
    updated_at = now();

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'set_finance_role_permission',
    'finance_role_permission',
    v_role || ':' || v_permission,
    jsonb_build_object(
      'role', v_role,
      'permission_key', v_permission,
      'previous_granted', coalesce(v_previous, false),
      'is_granted', coalesce(p_is_granted, false),
      'reason', v_reason
    )
  );

  perform public.agilecert_record_finance_audit(
    v_actor,
    null,
    'finance_role_permission',
    v_role || ':' || v_permission,
    'finance_role_permission_changed',
    jsonb_build_object(
      'role', v_role,
      'permissionKey', v_permission,
      'previousGranted', coalesce(v_previous, false),
      'isGranted', coalesce(p_is_granted, false),
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'role', v_role,
    'permissionKey', v_permission,
    'isGranted', coalesce(p_is_granted, false)
  );
end;
$$;

create or replace function public.get_finance_console_snapshot(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_base jsonb;
  v_access jsonb;
  v_permission_matrix jsonb := '[]'::jsonb;
  v_settings jsonb;
  v_audit jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.console.view') then
    raise exception 'This account does not have permission to view the Finance Console.';
  end if;

  v_base := public.get_admin_commerce_snapshot(v_limit);
  v_access := public.get_my_finance_console_access();

  if public.agilecert_has_finance_permission('finance.permissions.manage') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'role', 'exam_admin',
      'permissionKey', d.permission_key,
      'name', d.name,
      'description', d.description,
      'category', d.category,
      'riskLevel', d.risk_level,
      'isGranted', coalesce(rp.is_granted, false),
      'updatedAt', rp.updated_at
    ) order by d.category, d.name), '[]'::jsonb)
    into v_permission_matrix
    from public.agilecert_finance_permission_definitions d
    left join public.agilecert_finance_role_permissions rp
      on rp.role = 'exam_admin' and rp.permission_key = d.permission_key
    where d.is_active = true
      and d.permission_key <> 'finance.permissions.manage';
  end if;

  select jsonb_build_object(
    'defaultCurrency', s.default_currency,
    'quotePrefix', s.quote_prefix,
    'invoicePrefix', s.invoice_prefix,
    'receiptPrefix', s.receipt_prefix,
    'quoteValidityDays', s.quote_validity_days,
    'invoicePaymentTermsDays', s.invoice_payment_terms_days,
    'allowPartialPayments', s.allow_partial_payments,
    'allowOverpayments', s.allow_overpayments,
    'updatedAt', s.updated_at
  ) into v_settings
  from public.agilecert_finance_settings s
  where s.singleton = true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'actorId', a.actor_id,
    'actorName', p.full_name,
    'entityType', a.entity_type,
    'entityId', a.entity_id,
    'action', a.action,
    'metadata', a.metadata,
    'createdAt', a.created_at
  ) order by a.created_at desc), '[]'::jsonb)
  into v_audit
  from (
    select *
    from public.agilecert_finance_audit_events
    where entity_type in ('exam_price', 'finance_role_permission')
    order by created_at desc
    limit v_limit
  ) a
  left join public.profiles p on p.id = a.actor_id;

  return v_base || jsonb_build_object(
    'access', v_access,
    'permissionMatrix', v_permission_matrix,
    'financeSettings', coalesce(v_settings, '{}'::jsonb),
    'financeAudit', v_audit
  );
end;
$$;

create or replace function public.finance_upsert_exam_price(
  p_examination_id uuid,
  p_currency text,
  p_amount_minor bigint,
  p_country_codes text[] default '{}'::text[],
  p_is_default boolean default false,
  p_is_active boolean default true,
  p_effective_from timestamptz default now(),
  p_effective_to timestamptz default null,
  p_change_reason text default 'Finance Console examination fee update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := trim(coalesce(p_change_reason, ''));
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.exam_prices.manage') then
    raise exception 'This account does not have permission to manage examination fees.';
  end if;

  if length(v_reason) < 5 then
    raise exception 'Enter a reason of at least five characters for the fee change.';
  end if;

  select to_jsonb(ep) into v_before
  from public.exam_prices ep
  where ep.examination_id = p_examination_id
    and ep.currency = upper(trim(coalesce(p_currency, '')));

  v_result := public.admin_upsert_exam_price(
    p_examination_id,
    p_currency,
    p_amount_minor,
    p_country_codes,
    p_is_default,
    p_is_active,
    p_effective_from,
    p_effective_to
  );

  select to_jsonb(ep) into v_after
  from public.exam_prices ep
  where ep.id = (v_result ->> 'id')::uuid;

  perform public.agilecert_record_finance_audit(
    v_actor,
    null,
    'exam_price',
    v_result ->> 'id',
    'examination_fee_saved',
    jsonb_build_object(
      'reason', v_reason,
      'before', coalesce(v_before, 'null'::jsonb),
      'after', coalesce(v_after, 'null'::jsonb)
    )
  );

  return v_result || jsonb_build_object('changeReason', v_reason);
end;
$$;

create or replace function public.finance_set_exam_price_active(
  p_price_id uuid,
  p_is_active boolean,
  p_change_reason text default 'Finance Console examination fee status update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := trim(coalesce(p_change_reason, ''));
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.exam_prices.manage') then
    raise exception 'This account does not have permission to manage examination fees.';
  end if;

  if length(v_reason) < 5 then
    raise exception 'Enter a reason of at least five characters for the fee status change.';
  end if;

  select to_jsonb(ep) into v_before from public.exam_prices ep where ep.id = p_price_id;
  v_result := public.admin_set_exam_price_active(p_price_id, p_is_active);
  select to_jsonb(ep) into v_after from public.exam_prices ep where ep.id = p_price_id;

  perform public.agilecert_record_finance_audit(
    v_actor,
    null,
    'exam_price',
    p_price_id::text,
    'examination_fee_status_changed',
    jsonb_build_object(
      'reason', v_reason,
      'before', coalesce(v_before, 'null'::jsonb),
      'after', coalesce(v_after, 'null'::jsonb)
    )
  );

  return v_result || jsonb_build_object('changeReason', v_reason);
end;
$$;

create or replace function public.finance_upsert_coupon(
  p_coupon_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_description text default null,
  p_discount_type text default 'percentage',
  p_discount_value numeric default 0,
  p_currency text default null,
  p_scope text default 'all',
  p_programme_id uuid default null,
  p_examination_id uuid default null,
  p_minimum_amount_minor bigint default 0,
  p_maximum_discount_minor bigint default null,
  p_starts_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_maximum_redemptions integer default null,
  p_per_candidate_limit integer default 1,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agilecert_has_finance_permission('finance.coupons.manage') then
    raise exception 'This account does not have permission to manage discount codes.';
  end if;

  return public.admin_upsert_coupon(
    p_coupon_id, p_code, p_name, p_description, p_discount_type, p_discount_value,
    p_currency, p_scope, p_programme_id, p_examination_id,
    p_minimum_amount_minor, p_maximum_discount_minor,
    p_starts_at, p_expires_at, p_maximum_redemptions,
    p_per_candidate_limit, p_is_active
  );
end;
$$;

create or replace function public.finance_set_coupon_active(
  p_coupon_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agilecert_has_finance_permission('finance.coupons.manage') then
    raise exception 'This account does not have permission to manage discount codes.';
  end if;
  return public.admin_set_coupon_active(p_coupon_id, p_is_active);
end;
$$;

create or replace function public.finance_cancel_exam_order(
  p_order_id uuid,
  p_reason text default 'Cancelled from Finance Console'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agilecert_has_finance_permission('finance.orders.manage') then
    raise exception 'This account does not have permission to manage examination orders.';
  end if;
  return public.admin_cancel_exam_order(p_order_id, p_reason);
end;
$$;

-- Enforce the permission model for direct table access as well as RPC access.
drop policy if exists "exam_prices_select" on public.exam_prices;
create policy "exam_prices_select"
  on public.exam_prices for select to authenticated
  using (
    public.agilecert_has_finance_permission('finance.console.view')
    or (
      is_active = true
      and effective_from <= now()
      and (effective_to is null or effective_to > now())
    )
  );

drop policy if exists "exam_prices_admin_manage" on public.exam_prices;
create policy "exam_prices_admin_manage"
  on public.exam_prices for all to authenticated
  using (public.agilecert_has_finance_permission('finance.exam_prices.manage'))
  with check (public.agilecert_has_finance_permission('finance.exam_prices.manage'));

drop policy if exists "coupons_admin_manage" on public.coupons;
create policy "coupons_admin_manage"
  on public.coupons for all to authenticated
  using (public.agilecert_has_finance_permission('finance.coupons.manage'))
  with check (public.agilecert_has_finance_permission('finance.coupons.manage'));

drop policy if exists "exam_orders_select_own" on public.exam_orders;
create policy "exam_orders_select_own"
  on public.exam_orders for select to authenticated
  using (candidate_id = auth.uid() or public.agilecert_has_finance_permission('finance.console.view'));

drop policy if exists "exam_orders_admin_manage" on public.exam_orders;
create policy "exam_orders_admin_manage"
  on public.exam_orders for all to authenticated
  using (public.agilecert_has_finance_permission('finance.orders.manage'))
  with check (public.agilecert_has_finance_permission('finance.orders.manage'));

drop policy if exists "exam_payments_select_own" on public.exam_payments;
create policy "exam_payments_select_own"
  on public.exam_payments for select to authenticated
  using (
    public.agilecert_has_finance_permission('finance.console.view')
    or exists (
      select 1 from public.exam_orders eo
      where eo.id = order_id and eo.candidate_id = auth.uid()
    )
  );

drop policy if exists "exam_payments_admin_manage" on public.exam_payments;
create policy "exam_payments_admin_manage"
  on public.exam_payments for all to authenticated
  using (public.agilecert_has_finance_permission('finance.orders.manage'))
  with check (public.agilecert_has_finance_permission('finance.orders.manage'));

drop policy if exists "coupon_redemptions_select_own" on public.coupon_redemptions;
create policy "coupon_redemptions_select_own"
  on public.coupon_redemptions for select to authenticated
  using (candidate_id = auth.uid() or public.agilecert_has_finance_permission('finance.console.view'));

drop policy if exists "coupon_redemptions_admin_manage" on public.coupon_redemptions;
create policy "coupon_redemptions_admin_manage"
  on public.coupon_redemptions for all to authenticated
  using (public.agilecert_has_finance_permission('finance.orders.manage'))
  with check (public.agilecert_has_finance_permission('finance.orders.manage'));

alter table public.agilecert_finance_permission_definitions enable row level security;
alter table public.agilecert_finance_role_permissions enable row level security;

revoke all on table public.agilecert_finance_permission_definitions from public, anon, authenticated;
revoke all on table public.agilecert_finance_role_permissions from public, anon, authenticated;

-- Remove browser access to legacy broad-role RPCs. The new wrappers preserve
-- compatibility while enforcing permission-specific authority.
revoke execute on function public.get_admin_commerce_snapshot(integer) from authenticated;
revoke execute on function public.admin_upsert_exam_price(uuid, text, bigint, text[], boolean, boolean, timestamptz, timestamptz) from authenticated;
revoke execute on function public.admin_upsert_coupon(uuid, text, text, text, text, numeric, text, text, uuid, uuid, bigint, bigint, timestamptz, timestamptz, integer, integer, boolean) from authenticated;
revoke execute on function public.admin_set_coupon_active(uuid, boolean) from authenticated;
revoke execute on function public.admin_set_exam_price_active(uuid, boolean) from authenticated;
revoke execute on function public.admin_cancel_exam_order(uuid, text) from authenticated;

revoke all on function public.agilecert_has_finance_permission(text) from public, anon, authenticated;
revoke all on function public.get_my_finance_console_access() from public, anon, authenticated;
revoke all on function public.admin_set_finance_role_permission(text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.get_finance_console_snapshot(integer) from public, anon, authenticated;
revoke all on function public.finance_upsert_exam_price(uuid, text, bigint, text[], boolean, boolean, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.finance_set_exam_price_active(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.finance_upsert_coupon(uuid, text, text, text, text, numeric, text, text, uuid, uuid, bigint, bigint, timestamptz, timestamptz, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.finance_set_coupon_active(uuid, boolean) from public, anon, authenticated;
revoke all on function public.finance_cancel_exam_order(uuid, text) from public, anon, authenticated;

grant execute on function public.agilecert_has_finance_permission(text) to authenticated;
grant execute on function public.get_my_finance_console_access() to authenticated;
grant execute on function public.admin_set_finance_role_permission(text, text, boolean, text) to authenticated;
grant execute on function public.get_finance_console_snapshot(integer) to authenticated;
grant execute on function public.finance_upsert_exam_price(uuid, text, bigint, text[], boolean, boolean, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.finance_set_exam_price_active(uuid, boolean, text) to authenticated;
grant execute on function public.finance_upsert_coupon(uuid, text, text, text, text, numeric, text, text, uuid, uuid, bigint, bigint, timestamptz, timestamptz, integer, integer, boolean) to authenticated;
grant execute on function public.finance_set_coupon_active(uuid, boolean) to authenticated;
grant execute on function public.finance_cancel_exam_order(uuid, text) to authenticated;

commit;
