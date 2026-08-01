begin;

-- ---------------------------------------------------------------------------
-- Finance Console completion package
-- Advanced examination pricing, coupon governance, settings, reconciliation,
-- receipts, recovery, reporting and permission controls.
-- Existing Paystack and examination fulfilment functions remain authoritative.
-- ---------------------------------------------------------------------------

insert into public.agilecert_finance_permission_definitions (
  permission_key, name, description, category, risk_level
) values
  ('finance.settings.manage', 'Manage Finance Settings', 'Manage currencies, non-secret gateway status, tax, receipt, expiry, transfer and transaction-limit settings.', 'settings', 'restricted'),
  ('finance.transactions.reconcile', 'Reconcile Transactions', 'Review payment evidence and run controlled Paystack verification for individual and consolidated orders.', 'transactions', 'restricted'),
  ('finance.access.recover', 'Recover Paid Access', 'Retry idempotent access fulfilment for a verified paid individual or consolidated order.', 'transactions', 'restricted'),
  ('finance.adjustments.approve', 'Approve Finance Adjustments', 'Approve manual payment, refund, reversal and other high-impact finance adjustments.', 'adjustments', 'restricted'),
  ('finance.receipts.manage', 'Manage Receipts', 'Generate controlled receipt payloads for successful and waived examination orders.', 'receipts', 'sensitive'),
  ('finance.exports.download', 'Export Finance Data', 'Export permitted Finance Console transaction and dashboard data.', 'reports', 'sensitive'),
  ('finance.dashboard.view', 'View Finance Dashboard', 'View revenue, discount, coupon, failure and fulfilment reporting.', 'reports', 'standard')
on conflict (permission_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  risk_level = excluded.risk_level,
  is_active = true,
  updated_at = now();

-- Keep ordinary reporting available to Examination Administrators. High-impact
-- settings, verification, recovery and adjustment permissions remain ungranted
-- until a Super Administrator explicitly delegates them.
insert into public.agilecert_finance_role_permissions(role, permission_key, is_granted)
values
  ('exam_admin', 'finance.dashboard.view', true),
  ('exam_admin', 'finance.exports.download', true),
  ('exam_admin', 'finance.receipts.manage', true),
  ('exam_admin', 'finance.settings.manage', false),
  ('exam_admin', 'finance.transactions.reconcile', false),
  ('exam_admin', 'finance.access.recover', false),
  ('exam_admin', 'finance.adjustments.approve', false)
on conflict (role, permission_key) do nothing;

alter table public.agilecert_finance_settings
  add column if not exists supported_currencies text[] not null default array['NGN','USD']::text[],
  add column if not exists paystack_enabled boolean not null default true,
  add column if not exists paystack_environment text not null default 'production',
  add column if not exists paystack_status_note text,
  add column if not exists tax_enabled boolean not null default false,
  add column if not exists tax_label text not null default 'VAT',
  add column if not exists payment_reference_prefix text not null default 'IIPM',
  add column if not exists payment_expiry_minutes integer not null default 30,
  add column if not exists abandoned_order_hours integer not null default 24,
  add column if not exists refunds_enabled boolean not null default false,
  add column if not exists reversals_enabled boolean not null default false,
  add column if not exists manual_payment_approval_enabled boolean not null default false,
  add column if not exists bank_transfer_instructions text,
  add column if not exists minimum_transaction_minor bigint not null default 100,
  add column if not exists maximum_transaction_minor bigint;

alter table public.agilecert_finance_settings
  drop constraint if exists agilecert_finance_settings_paystack_environment_check;
alter table public.agilecert_finance_settings
  add constraint agilecert_finance_settings_paystack_environment_check
  check (paystack_environment in ('test', 'production'));
alter table public.agilecert_finance_settings
  drop constraint if exists agilecert_finance_settings_payment_expiry_minutes_check;
alter table public.agilecert_finance_settings
  add constraint agilecert_finance_settings_payment_expiry_minutes_check
  check (payment_expiry_minutes between 5 and 10080);
alter table public.agilecert_finance_settings
  drop constraint if exists agilecert_finance_settings_abandoned_order_hours_check;
alter table public.agilecert_finance_settings
  add constraint agilecert_finance_settings_abandoned_order_hours_check
  check (abandoned_order_hours between 1 and 2160);
alter table public.agilecert_finance_settings
  drop constraint if exists agilecert_finance_settings_transaction_limits_check;
alter table public.agilecert_finance_settings
  add constraint agilecert_finance_settings_transaction_limits_check
  check (
    minimum_transaction_minor >= 0
    and (maximum_transaction_minor is null or maximum_transaction_minor >= minimum_transaction_minor)
  );

create table if not exists public.agilecert_exam_pricing_policies (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  standard_amount_minor bigint not null check (standard_amount_minor > 0),
  promotional_amount_minor bigint check (promotional_amount_minor is null or promotional_amount_minor > 0),
  promotion_name text,
  promotion_starts_at timestamptz,
  promotion_ends_at timestamptz,
  access_mode text not null default 'paid'
    check (access_mode in ('paid', 'free', 'scholarship', 'invitation_only')),
  attempts_included integer not null default 1 check (attempts_included between 1 and 100),
  retake_amount_minor bigint check (retake_amount_minor is null or retake_amount_minor > 0),
  bulk_cart_eligible boolean not null default true,
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (examination_id, currency),
  check (
    (promotion_starts_at is null and promotion_ends_at is null)
    or (promotion_starts_at is not null and promotion_ends_at is not null and promotion_ends_at > promotion_starts_at)
  )
);

create index if not exists agilecert_exam_pricing_policies_active_idx
  on public.agilecert_exam_pricing_policies(examination_id, currency, is_active);

create table if not exists public.agilecert_exam_access_grants (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  access_mode text not null check (access_mode in ('scholarship', 'invitation_only')),
  grant_code text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  status text not null default 'active' check (status in ('active', 'used', 'revoked', 'expired')),
  reason text not null,
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create unique index if not exists agilecert_exam_access_grants_active_uidx
  on public.agilecert_exam_access_grants(candidate_id, examination_id, access_mode)
  where status = 'active';
create unique index if not exists agilecert_exam_access_grants_code_uidx
  on public.agilecert_exam_access_grants(upper(grant_code))
  where grant_code is not null;

alter table public.coupons
  add column if not exists minimum_module_count integer not null default 1,
  add column if not exists allow_multi_module_cart boolean not null default true;

alter table public.coupons
  drop constraint if exists coupons_minimum_module_count_check;
alter table public.coupons
  add constraint coupons_minimum_module_count_check
  check (minimum_module_count between 1 and 100);

create table if not exists public.agilecert_coupon_targets (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  target_type text not null check (target_type in ('programme', 'examination')),
  programme_id uuid references public.programmes(id) on delete cascade,
  examination_id uuid references public.examinations(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (target_type = 'programme' and programme_id is not null and examination_id is null)
    or (target_type = 'examination' and examination_id is not null and programme_id is null)
  )
);

create unique index if not exists agilecert_coupon_targets_programme_uidx
  on public.agilecert_coupon_targets(coupon_id, programme_id)
  where target_type = 'programme';
create unique index if not exists agilecert_coupon_targets_examination_uidx
  on public.agilecert_coupon_targets(coupon_id, examination_id)
  where target_type = 'examination';

create table if not exists public.agilecert_finance_recovery_actions (
  id uuid primary key default gen_random_uuid(),
  order_type text not null check (order_type in ('exam', 'bulk')),
  order_id uuid not null,
  reference text not null,
  action text not null check (action in ('manual_verification', 'access_recovery', 'refund_review', 'reversal_review')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
  reason text not null,
  outcome jsonb not null default '{}'::jsonb,
  requested_by uuid not null references public.profiles(id),
  processed_by uuid references public.profiles(id),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agilecert_finance_recovery_reference_idx
  on public.agilecert_finance_recovery_actions(reference, created_at desc);
create unique index if not exists agilecert_finance_recovery_active_uidx
  on public.agilecert_finance_recovery_actions(order_type, order_id, action)
  where status in ('queued', 'processing');

create trigger agilecert_exam_pricing_policies_set_updated_at
  before update on public.agilecert_exam_pricing_policies
  for each row execute function public.set_updated_at();
create trigger agilecert_exam_access_grants_set_updated_at
  before update on public.agilecert_exam_access_grants
  for each row execute function public.set_updated_at();
create trigger agilecert_coupon_targets_set_updated_at
  before update on public.agilecert_coupon_targets
  for each row execute function public.set_updated_at();
create trigger agilecert_finance_recovery_actions_set_updated_at
  before update on public.agilecert_finance_recovery_actions
  for each row execute function public.set_updated_at();

-- Backfill one policy per existing examination price without altering any
-- current checkout amount or historical order.
insert into public.agilecert_exam_pricing_policies (
  examination_id, currency, standard_amount_minor, is_active
)
select ep.examination_id, ep.currency, ep.amount_minor, ep.is_active
from public.exam_prices ep
on conflict (examination_id, currency) do nothing;

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
    'canViewDashboard', public.agilecert_has_finance_permission('finance.dashboard.view'),
    'canManageExamPrices', public.agilecert_has_finance_permission('finance.exam_prices.manage'),
    'canManageCertificatePrices', public.agilecert_has_finance_permission('finance.certificate_prices.manage'),
    'canManageCoupons', public.agilecert_has_finance_permission('finance.coupons.manage'),
    'canManageOrders', public.agilecert_has_finance_permission('finance.orders.manage'),
    'canManageSettings', public.agilecert_has_finance_permission('finance.settings.manage'),
    'canReconcileTransactions', public.agilecert_has_finance_permission('finance.transactions.reconcile'),
    'canRecoverAccess', public.agilecert_has_finance_permission('finance.access.recover'),
    'canApproveAdjustments', public.agilecert_has_finance_permission('finance.adjustments.approve'),
    'canManageReceipts', public.agilecert_has_finance_permission('finance.receipts.manage'),
    'canExportTransactions', public.agilecert_has_finance_permission('finance.exports.download'),
    'canManagePermissions', public.agilecert_has_finance_permission('finance.permissions.manage')
  );
end;
$$;

create or replace function public.agilecert_effective_exam_policy_amount(
  p_policy public.agilecert_exam_pricing_policies,
  p_candidate_id uuid default null
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attempt_count integer := 0;
  v_amount bigint;
begin
  v_amount := p_policy.standard_amount_minor;

  if p_policy.promotional_amount_minor is not null
     and p_policy.promotion_starts_at is not null
     and p_policy.promotion_ends_at is not null
     and now() >= p_policy.promotion_starts_at
     and now() < p_policy.promotion_ends_at then
    v_amount := p_policy.promotional_amount_minor;
  end if;

  if p_candidate_id is not null and to_regclass('public.exam_attempts') is not null then
    begin
      execute $sql$
        select count(*)::integer
        from public.exam_attempts
        where candidate_id = $1
          and examination_id = $2
          and status in ('submitted', 'completed', 'graded')
      $sql$ into v_attempt_count using p_candidate_id, p_policy.examination_id;
    exception when undefined_column then
      v_attempt_count := 0;
    end;
  end if;

  if v_attempt_count >= p_policy.attempts_included
     and p_policy.retake_amount_minor is not null then
    v_amount := p_policy.retake_amount_minor;
  end if;

  return v_amount;
end;
$$;

create or replace function public.finance_apply_due_exam_pricing_for_exam(
  p_examination_id uuid,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.agilecert_exam_pricing_policies%rowtype;
  v_amount bigint;
  v_price public.exam_prices%rowtype;
begin
  select * into v_policy
  from public.agilecert_exam_pricing_policies
  where examination_id = p_examination_id
    and currency = upper(trim(p_currency))
    and is_active = true;

  if not found or v_policy.access_mode <> 'paid' then
    return jsonb_build_object('updated', false, 'reason', 'no_active_paid_policy');
  end if;

  v_amount := public.agilecert_effective_exam_policy_amount(v_policy, null);

  update public.exam_prices
  set amount_minor = v_amount,
      is_active = true,
      updated_at = now()
  where examination_id = p_examination_id
    and currency = v_policy.currency
  returning * into v_price;

  if not found then
    insert into public.exam_prices(
      examination_id, currency, amount_minor, country_codes,
      is_default, is_active, effective_from, effective_to
    ) values (
      p_examination_id, v_policy.currency, v_amount, '{}'::text[],
      false, true, now(), null
    ) returning * into v_price;
  end if;

  return jsonb_build_object(
    'updated', true,
    'priceId', v_price.id,
    'amountMinor', v_price.amount_minor,
    'currency', v_price.currency
  );
end;
$$;

create or replace function public.finance_apply_due_exam_pricing_for_cart(
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate uuid := auth.uid();
  v_exam record;
  v_count integer := 0;
begin
  if v_candidate is null then
    raise exception 'Authentication is required.';
  end if;

  for v_exam in
    select item.examination_id
    from public.exam_carts cart
    join public.exam_cart_items item on item.cart_id = cart.id
    where cart.candidate_id = v_candidate
  loop
    perform public.finance_apply_due_exam_pricing_for_exam(v_exam.examination_id, p_currency);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('examCount', v_count, 'currency', upper(trim(p_currency)));
end;
$$;

create or replace function public.agilecert_coupon_applies_to_examination(
  p_coupon_id uuid,
  p_examination_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.agilecert_coupon_targets target
    where target.coupon_id = p_coupon_id and target.is_active = true
  ) or exists (
    select 1
    from public.agilecert_coupon_targets target
    join public.examinations exam on exam.id = p_examination_id
    where target.coupon_id = p_coupon_id
      and target.is_active = true
      and (
        (target.target_type = 'examination' and target.examination_id = p_examination_id)
        or (target.target_type = 'programme' and target.programme_id = exam.programme_id)
      )
  );
$$;

create or replace function public.agilecert_apply_exam_order_pricing_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.agilecert_exam_pricing_policies%rowtype;
  v_amount bigint;
  v_coupon public.coupons%rowtype;
  v_discount bigint := 0;
  v_settings public.agilecert_finance_settings%rowtype;
  v_grant public.agilecert_exam_access_grants%rowtype;
begin
  select * into v_policy
  from public.agilecert_exam_pricing_policies
  where examination_id = new.examination_id
    and currency = upper(new.currency)
    and is_active = true;

  if not found then
    return new;
  end if;

  v_amount := public.agilecert_effective_exam_policy_amount(v_policy, new.candidate_id);
  new.list_amount_minor := v_amount;
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'pricingPolicyId', v_policy.id,
    'accessMode', v_policy.access_mode,
    'attemptsIncluded', v_policy.attempts_included,
    'retakeAmountMinor', v_policy.retake_amount_minor,
    'promotionName', v_policy.promotion_name
  );

  if v_policy.access_mode in ('scholarship', 'invitation_only') then
    select * into v_grant
    from public.agilecert_exam_access_grants grant_row
    where grant_row.candidate_id = new.candidate_id
      and grant_row.examination_id = new.examination_id
      and grant_row.access_mode = v_policy.access_mode
      and grant_row.status = 'active'
      and grant_row.valid_from <= now()
      and (grant_row.valid_to is null or grant_row.valid_to > now())
    order by grant_row.created_at desc
    limit 1;

    if not found then
      raise exception 'This examination currently requires an active % grant.', replace(v_policy.access_mode, '_', ' ');
    end if;

    update public.agilecert_exam_access_grants
    set status = 'used', updated_at = now()
    where id = v_grant.id;

    new.metadata := new.metadata || jsonb_build_object('accessGrantId', v_grant.id);
  end if;

  if v_policy.access_mode in ('free', 'scholarship', 'invitation_only') then
    new.discount_amount_minor := new.list_amount_minor;
    new.payable_amount_minor := 0;
    new.status := 'waived';
    new.gateway := 'configured_' || v_policy.access_mode;
  else
    if new.coupon_id is not null then
      select * into v_coupon from public.coupons where id = new.coupon_id;
      if found then
        if not public.agilecert_coupon_applies_to_examination(v_coupon.id, new.examination_id) then
          raise exception 'This coupon does not apply to the selected examination.';
        end if;
        if v_coupon.minimum_module_count > 1 then
          raise exception 'This coupon requires a consolidated cart with at least % modules.', v_coupon.minimum_module_count;
        end if;
        if new.list_amount_minor < v_coupon.minimum_amount_minor then
          raise exception 'This examination is below the coupon minimum purchase value.';
        end if;
        if v_coupon.discount_type = 'percentage' then
          v_discount := round(new.list_amount_minor * v_coupon.discount_value / 100.0)::bigint;
        else
          v_discount := v_coupon.discount_value::bigint;
        end if;
        if v_coupon.maximum_discount_minor is not null then
          v_discount := least(v_discount, v_coupon.maximum_discount_minor);
        end if;
        v_discount := least(greatest(v_discount, 0), new.list_amount_minor);
      end if;
    end if;
    new.discount_amount_minor := v_discount;
    new.payable_amount_minor := new.list_amount_minor - new.discount_amount_minor;
  end if;

  select * into v_settings from public.agilecert_finance_settings where singleton = true;
  if found then
    new.expires_at := now() + make_interval(mins => v_settings.payment_expiry_minutes);
    if new.payable_amount_minor > 0 and new.payable_amount_minor < v_settings.minimum_transaction_minor then
      raise exception 'The payable amount is below the configured minimum transaction amount.';
    end if;
    if new.payable_amount_minor > 0
       and v_settings.maximum_transaction_minor is not null
       and new.payable_amount_minor > v_settings.maximum_transaction_minor then
      raise exception 'The payable amount exceeds the configured maximum transaction amount.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_exam_order_pricing_policy on public.exam_orders;
create trigger agilecert_exam_order_pricing_policy
  before insert on public.exam_orders
  for each row execute function public.agilecert_apply_exam_order_pricing_policy();

create or replace function public.agilecert_validate_bulk_item_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.agilecert_exam_pricing_policies%rowtype;
  v_candidate uuid;
  v_coupon_code text;
  v_coupon public.coupons%rowtype;
  v_attempt_count integer := 0;
  v_amount bigint;
  v_discount bigint := 0;
begin
  select bulk.candidate_id, bulk.coupon_code
  into v_candidate, v_coupon_code
  from public.exam_bulk_orders bulk
  where bulk.id = new.bulk_order_id;

  select * into v_policy
  from public.agilecert_exam_pricing_policies
  where examination_id = new.examination_id
    and currency = upper(new.currency)
    and is_active = true;

  if found then
    if not v_policy.bulk_cart_eligible then
      raise exception 'This examination is not eligible for consolidated-cart checkout.';
    end if;
    if v_policy.access_mode <> 'paid' then
      raise exception 'Free, scholarship and invitation-only access must be processed as an individual order.';
    end if;
    if v_policy.retake_amount_minor is not null and to_regclass('public.exam_attempts') is not null then
      begin
        execute $sql$
          select count(*)::integer from public.exam_attempts
          where candidate_id = $1 and examination_id = $2
            and status in ('submitted', 'completed', 'graded')
        $sql$ into v_attempt_count using v_candidate, new.examination_id;
      exception when undefined_column then
        v_attempt_count := 0;
      end;
      if v_attempt_count >= v_policy.attempts_included then
        raise exception 'Retake pricing for this examination requires individual checkout.';
      end if;
    end if;
    v_amount := public.agilecert_effective_exam_policy_amount(v_policy, v_candidate);
    new.list_amount_minor := v_amount;
  end if;

  if v_coupon_code is not null then
    select * into v_coupon from public.coupons where upper(code) = upper(trim(v_coupon_code));
    if found then
      if not public.agilecert_coupon_applies_to_examination(v_coupon.id, new.examination_id) then
        raise exception 'This coupon does not apply to one or more selected examinations.';
      end if;
      if v_coupon.discount_type = 'percentage' then
        v_discount := round(new.list_amount_minor * v_coupon.discount_value / 100.0)::bigint;
      else
        v_discount := v_coupon.discount_value::bigint;
      end if;
      if v_coupon.maximum_discount_minor is not null then
        v_discount := least(v_discount, v_coupon.maximum_discount_minor);
      end if;
      v_discount := least(greatest(v_discount,0),new.list_amount_minor);
      new.coupon_id := v_coupon.id;
      new.discount_amount_minor := v_discount;
      new.payable_amount_minor := new.list_amount_minor - v_discount;
    end if;
  else
    new.discount_amount_minor := 0;
    new.payable_amount_minor := new.list_amount_minor;
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_bulk_item_policy on public.exam_bulk_order_items;
create trigger agilecert_bulk_item_policy
  before insert on public.exam_bulk_order_items
  for each row execute function public.agilecert_validate_bulk_item_policy();

create or replace function public.agilecert_validate_bulk_coupon_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_settings public.agilecert_finance_settings%rowtype;
  v_item record;
  v_policy public.agilecert_exam_pricing_policies%rowtype;
  v_amount bigint;
  v_discount bigint;
  v_list bigint := 0;
  v_discount_total bigint := 0;
  v_count integer := 0;
begin
  -- Recalculate the parent order from current effective policies so future
  -- promotion start/end dates are authoritative even when no administrator
  -- has reopened the console.
  if new.cart_id is not null then
    for v_item in
      select item.examination_id
      from public.exam_cart_items item
      where item.cart_id = new.cart_id
    loop
      select * into v_policy
      from public.agilecert_exam_pricing_policies
      where examination_id = v_item.examination_id
        and currency = upper(new.currency)
        and is_active = true;

      if found then
        if not v_policy.bulk_cart_eligible or v_policy.access_mode <> 'paid' then
          raise exception 'One or more selected examinations require individual checkout.';
        end if;
        v_amount := public.agilecert_effective_exam_policy_amount(v_policy, new.candidate_id);
      else
        select amount_minor into v_amount from public.exam_prices
        where examination_id = v_item.examination_id
          and currency = upper(new.currency)
          and is_active = true
          and effective_from <= now()
          and (effective_to is null or effective_to > now());
      end if;
      if v_amount is null then raise exception 'An active price is missing for a selected examination.'; end if;
      v_count := v_count + 1;
      v_list := v_list + v_amount;

      if new.coupon_code is not null then
        select * into v_coupon from public.coupons where upper(code)=upper(trim(new.coupon_code));
        if found then
          if not public.agilecert_coupon_applies_to_examination(v_coupon.id, v_item.examination_id) then
            raise exception 'This coupon does not apply to one or more selected examinations.';
          end if;
          if v_coupon.discount_type = 'percentage' then
            v_discount := round(v_amount * v_coupon.discount_value / 100.0)::bigint;
          else
            v_discount := v_coupon.discount_value::bigint;
          end if;
          if v_coupon.maximum_discount_minor is not null then
            v_discount := least(v_discount, v_coupon.maximum_discount_minor);
          end if;
          v_discount_total := v_discount_total + least(greatest(v_discount,0),v_amount);
        end if;
      end if;
    end loop;
    new.item_count := v_count;
    new.list_amount_minor := v_list;
    new.discount_amount_minor := least(v_discount_total,v_list);
    new.payable_amount_minor := new.list_amount_minor - new.discount_amount_minor;
  end if;

  if new.coupon_code is not null and trim(new.coupon_code) <> '' then
    select * into v_coupon from public.coupons where upper(code) = upper(trim(new.coupon_code));
    if found then
      if not v_coupon.allow_multi_module_cart then
        raise exception 'This coupon is not permitted in a consolidated cart.';
      end if;
      if new.item_count < v_coupon.minimum_module_count then
        raise exception 'This coupon requires at least % modules in the cart.', v_coupon.minimum_module_count;
      end if;
      if new.list_amount_minor < v_coupon.minimum_amount_minor then
        raise exception 'This cart is below the coupon minimum cart value.';
      end if;
    end if;
  end if;

  select * into v_settings from public.agilecert_finance_settings where singleton = true;
  if found then
    new.expires_at := now() + make_interval(mins => v_settings.payment_expiry_minutes);
    if new.payable_amount_minor > 0 and new.payable_amount_minor < v_settings.minimum_transaction_minor then
      raise exception 'The consolidated amount is below the configured minimum transaction amount.';
    end if;
    if new.payable_amount_minor > 0
       and v_settings.maximum_transaction_minor is not null
       and new.payable_amount_minor > v_settings.maximum_transaction_minor then
      raise exception 'The consolidated amount exceeds the configured maximum transaction amount.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_bulk_coupon_policy on public.exam_bulk_orders;
create trigger agilecert_bulk_coupon_policy
  before insert or update of coupon_code, item_count, list_amount_minor, payable_amount_minor
  on public.exam_bulk_orders
  for each row execute function public.agilecert_validate_bulk_coupon_policy();

create or replace function public.agilecert_validate_coupon_redemption_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_examination uuid;
  v_programme uuid;
begin
  if not exists (
    select 1 from public.agilecert_coupon_targets target
    where target.coupon_id = new.coupon_id and target.is_active = true
  ) then
    return new;
  end if;

  select order_row.examination_id, exam.programme_id
  into v_examination, v_programme
  from public.exam_orders order_row
  join public.examinations exam on exam.id = order_row.examination_id
  where order_row.id = new.order_id;

  if not exists (
    select 1 from public.agilecert_coupon_targets target
    where target.coupon_id = new.coupon_id
      and target.is_active = true
      and (
        (target.target_type = 'examination' and target.examination_id = v_examination)
        or (target.target_type = 'programme' and target.programme_id = v_programme)
      )
  ) then
    raise exception 'This coupon does not apply to the selected examination.';
  end if;

  return new;
end;
$$;

drop trigger if exists agilecert_coupon_redemption_target on public.coupon_redemptions;
create trigger agilecert_coupon_redemption_target
  before insert or update of coupon_id, order_id on public.coupon_redemptions
  for each row execute function public.agilecert_validate_coupon_redemption_target();

create or replace function public.finance_mark_abandoned_orders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_exam integer := 0;
  v_bulk integer := 0;
  v_cutoff timestamptz;
begin
  if v_actor is not null and not public.agilecert_has_finance_permission('finance.orders.manage') then
    raise exception 'This account does not have permission to process abandoned orders.';
  end if;

  select now() - make_interval(hours => abandoned_order_hours)
  into v_cutoff
  from public.agilecert_finance_settings where singleton = true;
  v_cutoff := coalesce(v_cutoff, now() - interval '24 hours');

  with changed as (
    update public.exam_orders
    set status = case when expires_at <= now() then 'expired' else 'cancelled' end,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('abandonedProcessedAt', now()),
        updated_at = now()
    where status = 'pending'
      and created_at <= v_cutoff
    returning id
  ) select count(*) into v_exam from changed;

  with changed as (
    update public.exam_bulk_orders
    set status = case when expires_at <= now() then 'expired' else 'cancelled' end,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('abandonedProcessedAt', now()),
        updated_at = now()
    where status in ('building', 'pending')
      and created_at <= v_cutoff
    returning id
  ) select count(*) into v_bulk from changed;

  update public.exam_payments payment
  set status = 'abandoned', updated_at = now()
  from public.exam_orders order_row
  where payment.order_id = order_row.id
    and payment.status = 'initiated'
    and order_row.status in ('cancelled', 'expired');

  update public.exam_bulk_payments payment
  set status = 'abandoned', updated_at = now()
  from public.exam_bulk_orders order_row
  where payment.bulk_order_id = order_row.id
    and payment.status = 'initiated'
    and order_row.status in ('cancelled', 'expired');

  return jsonb_build_object('individualOrders', v_exam, 'bulkOrders', v_bulk);
end;
$$;

create or replace function public.finance_upsert_exam_pricing_policy(
  p_examination_id uuid,
  p_currency text,
  p_standard_amount_minor bigint,
  p_promotional_amount_minor bigint default null,
  p_promotion_name text default null,
  p_promotion_starts_at timestamptz default null,
  p_promotion_ends_at timestamptz default null,
  p_access_mode text default 'paid',
  p_attempts_included integer default 1,
  p_retake_amount_minor bigint default null,
  p_bulk_cart_eligible boolean default true,
  p_is_active boolean default true,
  p_change_reason text default 'Approved advanced examination pricing update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_currency text := upper(trim(p_currency));
  v_reason text := trim(coalesce(p_change_reason, ''));
  v_before jsonb;
  v_after jsonb;
  v_policy public.agilecert_exam_pricing_policies%rowtype;
begin
  if not public.agilecert_has_finance_permission('finance.exam_prices.manage') then
    raise exception 'This account does not have permission to manage examination fees.';
  end if;
  if length(v_reason) < 5 then raise exception 'Enter a reason for the pricing change.'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code.'; end if;
  if p_standard_amount_minor <= 0 then raise exception 'The standard fee must be greater than zero.'; end if;
  if p_access_mode not in ('paid','free','scholarship','invitation_only') then raise exception 'Select a valid access mode.'; end if;

  select to_jsonb(policy) into v_before
  from public.agilecert_exam_pricing_policies policy
  where examination_id = p_examination_id and currency = v_currency;

  insert into public.agilecert_exam_pricing_policies(
    examination_id, currency, standard_amount_minor, promotional_amount_minor,
    promotion_name, promotion_starts_at, promotion_ends_at, access_mode,
    attempts_included, retake_amount_minor, bulk_cart_eligible, is_active, updated_by
  ) values (
    p_examination_id, v_currency, p_standard_amount_minor, p_promotional_amount_minor,
    nullif(trim(coalesce(p_promotion_name, '')), ''), p_promotion_starts_at, p_promotion_ends_at,
    p_access_mode, p_attempts_included, p_retake_amount_minor,
    case when p_access_mode = 'paid' then coalesce(p_bulk_cart_eligible, true) else false end,
    coalesce(p_is_active, true), v_actor
  )
  on conflict (examination_id, currency) do update set
    standard_amount_minor = excluded.standard_amount_minor,
    promotional_amount_minor = excluded.promotional_amount_minor,
    promotion_name = excluded.promotion_name,
    promotion_starts_at = excluded.promotion_starts_at,
    promotion_ends_at = excluded.promotion_ends_at,
    access_mode = excluded.access_mode,
    attempts_included = excluded.attempts_included,
    retake_amount_minor = excluded.retake_amount_minor,
    bulk_cart_eligible = excluded.bulk_cart_eligible,
    is_active = excluded.is_active,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into v_policy;

  perform public.finance_apply_due_exam_pricing_for_exam(p_examination_id, v_currency);
  select to_jsonb(v_policy) into v_after;

  perform public.agilecert_record_finance_audit(
    v_actor, null, 'exam_pricing_policy', v_policy.id::text,
    'advanced_exam_pricing_saved',
    jsonb_build_object('reason', v_reason, 'before', coalesce(v_before, 'null'::jsonb), 'after', v_after)
  );

  return jsonb_build_object(
    'id', v_policy.id,
    'examinationId', v_policy.examination_id,
    'currency', v_policy.currency,
    'standardAmountMinor', v_policy.standard_amount_minor,
    'promotionalAmountMinor', v_policy.promotional_amount_minor,
    'promotionName', v_policy.promotion_name,
    'promotionStartsAt', v_policy.promotion_starts_at,
    'promotionEndsAt', v_policy.promotion_ends_at,
    'accessMode', v_policy.access_mode,
    'attemptsIncluded', v_policy.attempts_included,
    'retakeAmountMinor', v_policy.retake_amount_minor,
    'bulkCartEligible', v_policy.bulk_cart_eligible,
    'isActive', v_policy.is_active
  );
end;
$$;

create or replace function public.finance_upsert_exam_access_grant(
  p_grant_id uuid,
  p_candidate_id uuid,
  p_examination_id uuid,
  p_access_mode text,
  p_grant_code text,
  p_valid_from timestamptz,
  p_valid_to timestamptz,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_grant public.agilecert_exam_access_grants%rowtype;
begin
  if not public.agilecert_has_finance_permission('finance.adjustments.approve') then
    raise exception 'This account does not have permission to approve scholarship or invitation access.';
  end if;
  if p_access_mode not in ('scholarship','invitation_only') then raise exception 'Select scholarship or invitation-only access.'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Enter a reason for the access grant.'; end if;

  insert into public.agilecert_exam_access_grants(
    id, candidate_id, examination_id, access_mode, grant_code,
    valid_from, valid_to, status, reason, granted_by
  ) values (
    coalesce(p_grant_id, gen_random_uuid()), p_candidate_id, p_examination_id,
    p_access_mode, nullif(upper(trim(coalesce(p_grant_code,''))), ''),
    coalesce(p_valid_from, now()), p_valid_to, coalesce(p_status,'active'), trim(p_reason), v_actor
  )
  on conflict (id) do update set
    candidate_id = excluded.candidate_id,
    examination_id = excluded.examination_id,
    access_mode = excluded.access_mode,
    grant_code = excluded.grant_code,
    valid_from = excluded.valid_from,
    valid_to = excluded.valid_to,
    status = excluded.status,
    reason = excluded.reason,
    granted_by = v_actor,
    updated_at = now()
  returning * into v_grant;

  perform public.agilecert_record_finance_audit(
    v_actor, null, 'exam_access_grant', v_grant.id::text,
    'exam_access_grant_saved',
    jsonb_build_object('reason', p_reason, 'candidateId', p_candidate_id, 'examinationId', p_examination_id, 'accessMode', p_access_mode, 'status', v_grant.status)
  );

  return to_jsonb(v_grant);
end;
$$;

create or replace function public.finance_upsert_coupon_advanced(
  p_coupon_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_description text default null,
  p_discount_type text default 'percentage',
  p_discount_value numeric default 0,
  p_currency text default null,
  p_programme_ids uuid[] default '{}'::uuid[],
  p_examination_ids uuid[] default '{}'::uuid[],
  p_minimum_amount_minor bigint default 0,
  p_minimum_module_count integer default 1,
  p_allow_multi_module_cart boolean default true,
  p_maximum_discount_minor bigint default null,
  p_starts_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_maximum_redemptions integer default null,
  p_per_candidate_limit integer default 1,
  p_is_active boolean default true,
  p_change_reason text default 'Approved coupon configuration update'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := trim(coalesce(p_change_reason,''));
  v_result jsonb;
  v_coupon_id uuid;
  v_before jsonb;
  v_programme uuid;
  v_examination uuid;
  v_scope text := 'all';
  v_existing_programme_id uuid;
  v_existing_examination_id uuid;
begin
  if not public.agilecert_has_finance_permission('finance.coupons.manage') then
    raise exception 'This account does not have permission to manage discount codes.';
  end if;
  if length(v_reason) < 5 then raise exception 'Enter a reason for the coupon change.'; end if;

  if p_coupon_id is not null then
    select to_jsonb(c) into v_before from public.coupons c where c.id = p_coupon_id;
  end if;

  if coalesce(cardinality(p_programme_ids),0) + coalesce(cardinality(p_examination_ids),0) > 0 then
    v_scope := 'all';
  elsif p_coupon_id is not null then
    select c.scope, c.programme_id, c.examination_id
    into v_scope, v_existing_programme_id, v_existing_examination_id
    from public.coupons c where c.id = p_coupon_id;
    v_scope := coalesce(v_scope, 'all');
  end if;

  v_result := public.admin_upsert_coupon(
    p_coupon_id, p_code, p_name, p_description, p_discount_type, p_discount_value,
    p_currency, v_scope, v_existing_programme_id, v_existing_examination_id,
    p_minimum_amount_minor, p_maximum_discount_minor,
    p_starts_at, p_expires_at, p_maximum_redemptions, p_per_candidate_limit, p_is_active
  );

  v_coupon_id := (v_result ->> 'id')::uuid;
  update public.coupons
  set minimum_module_count = greatest(1, coalesce(p_minimum_module_count,1)),
      allow_multi_module_cart = coalesce(p_allow_multi_module_cart,true),
      updated_at = now()
  where id = v_coupon_id;

  delete from public.agilecert_coupon_targets where coupon_id = v_coupon_id;
  foreach v_programme in array coalesce(p_programme_ids, '{}'::uuid[]) loop
    insert into public.agilecert_coupon_targets(coupon_id, target_type, programme_id, created_by)
    values (v_coupon_id, 'programme', v_programme, v_actor)
    on conflict do nothing;
  end loop;
  foreach v_examination in array coalesce(p_examination_ids, '{}'::uuid[]) loop
    insert into public.agilecert_coupon_targets(coupon_id, target_type, examination_id, created_by)
    values (v_coupon_id, 'examination', v_examination, v_actor)
    on conflict do nothing;
  end loop;

  perform public.agilecert_record_finance_audit(
    v_actor, null, 'coupon', v_coupon_id::text, 'coupon_configuration_saved',
    jsonb_build_object(
      'reason', v_reason,
      'before', coalesce(v_before,'null'::jsonb),
      'after', (select to_jsonb(c) from public.coupons c where c.id = v_coupon_id),
      'programmeIds', coalesce(to_jsonb(p_programme_ids),'[]'::jsonb),
      'examinationIds', coalesce(to_jsonb(p_examination_ids),'[]'::jsonb)
    )
  );

  return v_result || jsonb_build_object(
    'minimumModuleCount', greatest(1, coalesce(p_minimum_module_count,1)),
    'allowMultiModuleCart', coalesce(p_allow_multi_module_cart,true),
    'programmeIds', coalesce(to_jsonb(p_programme_ids),'[]'::jsonb),
    'examinationIds', coalesce(to_jsonb(p_examination_ids),'[]'::jsonb)
  );
end;
$$;

create or replace function public.finance_set_coupon_active_audited(
  p_coupon_id uuid,
  p_is_active boolean,
  p_change_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_result jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.coupons.manage') then
    raise exception 'This account does not have permission to manage discount codes.';
  end if;
  if length(trim(coalesce(p_change_reason,''))) < 5 then raise exception 'Enter a reason for the coupon status change.'; end if;
  select to_jsonb(c) into v_before from public.coupons c where c.id = p_coupon_id;
  v_result := public.admin_set_coupon_active(p_coupon_id, p_is_active);
  perform public.agilecert_record_finance_audit(
    v_actor, null, 'coupon', p_coupon_id::text, 'coupon_status_changed',
    jsonb_build_object('reason', p_change_reason, 'before', coalesce(v_before,'null'::jsonb), 'after', (select to_jsonb(c) from public.coupons c where c.id=p_coupon_id))
  );
  return v_result;
end;
$$;

create or replace function public.finance_upsert_general_settings(
  p_default_currency text,
  p_supported_currencies text[],
  p_paystack_enabled boolean,
  p_paystack_environment text,
  p_paystack_status_note text,
  p_tax_enabled boolean,
  p_tax_label text,
  p_default_tax_profile_id uuid,
  p_receipt_prefix text,
  p_payment_reference_prefix text,
  p_payment_expiry_minutes integer,
  p_abandoned_order_hours integer,
  p_refunds_enabled boolean,
  p_reversals_enabled boolean,
  p_manual_payment_approval_enabled boolean,
  p_bank_transfer_instructions text,
  p_minimum_transaction_minor bigint,
  p_maximum_transaction_minor bigint,
  p_allow_partial_payments boolean,
  p_allow_overpayments boolean,
  p_change_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_currencies text[];
begin
  if not public.agilecert_has_finance_permission('finance.settings.manage') then
    raise exception 'This account does not have permission to manage finance settings.';
  end if;
  if length(trim(coalesce(p_change_reason,''))) < 5 then raise exception 'Enter a reason for the settings change.'; end if;
  if upper(trim(p_default_currency)) !~ '^[A-Z]{3}$' then raise exception 'Default currency must be a three-letter ISO code.'; end if;

  select coalesce(array_agg(distinct upper(trim(currency))) filter (where upper(trim(currency)) ~ '^[A-Z]{3}$'), '{}'::text[])
  into v_currencies from unnest(coalesce(p_supported_currencies,'{}'::text[])) currency;
  if not upper(trim(p_default_currency)) = any(v_currencies) then
    v_currencies := array_append(v_currencies, upper(trim(p_default_currency)));
  end if;

  select to_jsonb(s) into v_before from public.agilecert_finance_settings s where singleton = true;

  update public.agilecert_finance_settings
  set default_currency = upper(trim(p_default_currency)),
      supported_currencies = v_currencies,
      paystack_enabled = coalesce(p_paystack_enabled,true),
      paystack_environment = p_paystack_environment,
      paystack_status_note = nullif(trim(coalesce(p_paystack_status_note,'')),''),
      tax_enabled = coalesce(p_tax_enabled,false),
      tax_label = coalesce(nullif(trim(p_tax_label),''),'VAT'),
      default_tax_profile_id = p_default_tax_profile_id,
      receipt_prefix = upper(trim(p_receipt_prefix)),
      payment_reference_prefix = upper(trim(p_payment_reference_prefix)),
      payment_expiry_minutes = p_payment_expiry_minutes,
      abandoned_order_hours = p_abandoned_order_hours,
      refunds_enabled = coalesce(p_refunds_enabled,false),
      reversals_enabled = coalesce(p_reversals_enabled,false),
      manual_payment_approval_enabled = coalesce(p_manual_payment_approval_enabled,false),
      bank_transfer_instructions = nullif(trim(coalesce(p_bank_transfer_instructions,'')),''),
      minimum_transaction_minor = p_minimum_transaction_minor,
      maximum_transaction_minor = p_maximum_transaction_minor,
      allow_partial_payments = coalesce(p_allow_partial_payments,false),
      allow_overpayments = coalesce(p_allow_overpayments,false),
      updated_by = v_actor,
      updated_at = now()
  where singleton = true;

  select to_jsonb(s) into v_after from public.agilecert_finance_settings s where singleton = true;
  perform public.agilecert_record_finance_audit(
    v_actor, null, 'finance_settings', 'singleton', 'finance_settings_saved',
    jsonb_build_object('reason', p_change_reason, 'before', v_before, 'after', v_after)
  );
  return v_after;
end;
$$;

create or replace function public.finance_queue_recovery_action(
  p_order_type text,
  p_order_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reference text;
  v_action public.agilecert_finance_recovery_actions%rowtype;
begin
  if p_action = 'manual_verification' and not public.agilecert_has_finance_permission('finance.transactions.reconcile') then
    raise exception 'This account does not have permission to reconcile transactions.';
  elsif p_action = 'access_recovery' and not public.agilecert_has_finance_permission('finance.access.recover') then
    raise exception 'This account does not have permission to recover paid access.';
  elsif p_action in ('refund_review','reversal_review') and not public.agilecert_has_finance_permission('finance.adjustments.approve') then
    raise exception 'This account does not have permission to approve finance adjustments.';
  end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Enter a reason for the recovery action.'; end if;

  if p_order_type = 'exam' then
    select reference into v_reference from public.exam_orders where id = p_order_id;
  elsif p_order_type = 'bulk' then
    select reference into v_reference from public.exam_bulk_orders where id = p_order_id;
  else
    raise exception 'Select an individual or consolidated order.';
  end if;
  if v_reference is null then raise exception 'The selected order was not found.'; end if;

  insert into public.agilecert_finance_recovery_actions(
    order_type, order_id, reference, action, reason, requested_by
  ) values (
    p_order_type, p_order_id, v_reference, p_action, trim(p_reason), v_actor
  )
  on conflict (order_type, order_id, action) where status in ('queued','processing')
  do update set reason = excluded.reason, requested_by = excluded.requested_by, requested_at = now(), updated_at = now()
  returning * into v_action;

  perform public.agilecert_record_finance_audit(
    v_actor, null, 'finance_recovery_action', v_action.id::text, 'finance_recovery_queued',
    jsonb_build_object('reason', p_reason, 'orderType', p_order_type, 'orderId', p_order_id, 'reference', v_reference, 'action', p_action)
  );
  return to_jsonb(v_action);
end;
$$;

create or replace function public.finance_recover_paid_exam_order(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_payment public.exam_payments%rowtype;
  v_result jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.access.recover') then
    raise exception 'This account does not have permission to recover paid access.';
  end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Enter a reason for access recovery.'; end if;

  select * into v_payment from public.exam_payments
  where order_id = p_order_id and status = 'success'
  order by paid_at desc nulls last, created_at desc limit 1;
  if not found then raise exception 'No successful payment exists for this examination order.'; end if;

  v_result := public.fulfil_paid_exam_order(p_order_id, v_payment.provider_transaction_id, v_payment.provider_payload);
  perform public.agilecert_record_finance_audit(
    v_actor, null, 'exam_order', p_order_id::text, 'paid_access_recovered',
    jsonb_build_object('reason', p_reason, 'paymentId', v_payment.id, 'result', v_result)
  );
  return v_result;
end;
$$;

create or replace function public.finance_recover_paid_bulk_order(
  p_bulk_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_payment public.exam_bulk_payments%rowtype;
  v_result jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.access.recover') then
    raise exception 'This account does not have permission to recover consolidated paid access.';
  end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Enter a reason for access recovery.'; end if;

  select * into v_payment from public.exam_bulk_payments
  where bulk_order_id = p_bulk_order_id and status = 'success'
  order by paid_at desc nulls last, created_at desc limit 1;
  if not found then raise exception 'No successful payment exists for this consolidated order.'; end if;

  v_result := public.fulfil_paid_exam_bulk_order(p_bulk_order_id, v_payment.provider_transaction_id, v_payment.provider_payload);
  perform public.agilecert_record_finance_audit(
    v_actor, null, 'exam_bulk_order', p_bulk_order_id::text, 'bulk_paid_access_recovered',
    jsonb_build_object('reason', p_reason, 'paymentId', v_payment.id, 'result', v_result)
  );
  return v_result;
end;
$$;

create or replace function public.finance_get_receipt_payload(
  p_order_type text,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_payload jsonb;
  v_prefix text;
begin
  if not public.agilecert_has_finance_permission('finance.receipts.manage') then
    raise exception 'This account does not have permission to generate receipts.';
  end if;
  select receipt_prefix into v_prefix from public.agilecert_finance_settings where singleton = true;

  if p_order_type = 'exam' then
    select jsonb_build_object(
      'receiptNumber', coalesce(v_prefix,'AGR') || '-' || order_row.reference,
      'orderType', 'exam', 'orderId', order_row.id, 'reference', order_row.reference,
      'candidateName', profile.full_name, 'candidateEmail', profile.email,
      'programmeCode', programme.code, 'programmeName', programme.name,
      'examinationTitle', exam.title, 'currency', order_row.currency,
      'grossAmountMinor', order_row.list_amount_minor,
      'discountAmountMinor', order_row.discount_amount_minor,
      'amountPaidMinor', order_row.payable_amount_minor,
      'couponCode', case when coupon.id is null then null else upper(coupon.code) end,
      'status', order_row.status, 'paidAt', order_row.paid_at,
      'fulfilledAt', order_row.fulfilled_at, 'issuedAt', now()
    ) into v_payload
    from public.exam_orders order_row
    join public.profiles profile on profile.id = order_row.candidate_id
    join public.examinations exam on exam.id = order_row.examination_id
    join public.programmes programme on programme.id = exam.programme_id
    left join public.coupons coupon on coupon.id = order_row.coupon_id
    where order_row.id = p_order_id and order_row.status in ('paid','waived');
  elsif p_order_type = 'bulk' then
    select jsonb_build_object(
      'receiptNumber', coalesce(v_prefix,'AGR') || '-' || bulk.reference,
      'orderType', 'bulk', 'orderId', bulk.id, 'reference', bulk.reference,
      'candidateName', profile.full_name, 'candidateEmail', profile.email,
      'itemCount', bulk.item_count, 'currency', bulk.currency,
      'grossAmountMinor', bulk.list_amount_minor,
      'discountAmountMinor', bulk.discount_amount_minor,
      'amountPaidMinor', bulk.payable_amount_minor,
      'couponCode', bulk.coupon_code, 'status', bulk.status,
      'paidAt', bulk.paid_at, 'fulfilledAt', bulk.fulfilled_at, 'issuedAt', now(),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'examinationTitle', item.examination_title,
          'listAmountMinor', item.list_amount_minor,
          'discountAmountMinor', item.discount_amount_minor,
          'payableAmountMinor', item.payable_amount_minor,
          'status', item.status
        ) order by item.position)
        from public.exam_bulk_order_items item where item.bulk_order_id = bulk.id
      ), '[]'::jsonb)
    ) into v_payload
    from public.exam_bulk_orders bulk
    join public.profiles profile on profile.id = bulk.candidate_id
    where bulk.id = p_order_id and bulk.status in ('paid','partially_fulfilled','fulfilled');
  else
    raise exception 'Select an individual or consolidated order.';
  end if;

  if v_payload is null then raise exception 'A receiptable order was not found.'; end if;
  perform public.agilecert_record_finance_audit(v_actor, null, 'receipt', p_order_type || ':' || p_order_id::text, 'receipt_payload_generated', jsonb_build_object('receiptNumber', v_payload->>'receiptNumber'));
  return v_payload;
end;
$$;

create or replace function public.finance_record_export(
  p_export_type text,
  p_row_count integer,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_actor uuid := auth.uid(); begin
  if not public.agilecert_has_finance_permission('finance.exports.download') then
    raise exception 'This account does not have permission to export finance data.';
  end if;
  perform public.agilecert_record_finance_audit(v_actor, null, 'finance_export', null, 'finance_data_exported', jsonb_build_object('exportType', p_export_type, 'rowCount', greatest(coalesce(p_row_count,0),0), 'filters', coalesce(p_filters,'{}'::jsonb)));
  return jsonb_build_object('recorded', true, 'exportType', p_export_type, 'rowCount', greatest(coalesce(p_row_count,0),0));
end;
$$;

create or replace function public.get_finance_console_completion_snapshot(
  p_limit integer default 250,
  p_from timestamptz default (now() - interval '90 days'),
  p_to timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit,250),1000));
  v_from timestamptz := coalesce(p_from, now() - interval '90 days');
  v_to timestamptz := coalesce(p_to, now());
  v_access jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.console.view') then
    raise exception 'This account does not have permission to view the Finance Console.';
  end if;
  v_access := public.get_my_finance_console_access();

  return jsonb_build_object(
    'generatedAt', now(),
    'from', v_from,
    'to', v_to,
    'access', v_access,
    'settings', (
      select jsonb_build_object(
        'defaultCurrency', s.default_currency,
        'supportedCurrencies', s.supported_currencies,
        'paystackEnabled', s.paystack_enabled,
        'paystackEnvironment', s.paystack_environment,
        'paystackConfigured', s.paystack_enabled,
        'paystackStatusNote', s.paystack_status_note,
        'taxEnabled', s.tax_enabled,
        'taxLabel', s.tax_label,
        'defaultTaxProfileId', s.default_tax_profile_id,
        'receiptPrefix', s.receipt_prefix,
        'paymentReferencePrefix', s.payment_reference_prefix,
        'paymentExpiryMinutes', s.payment_expiry_minutes,
        'abandonedOrderHours', s.abandoned_order_hours,
        'refundsEnabled', s.refunds_enabled,
        'reversalsEnabled', s.reversals_enabled,
        'manualPaymentApprovalEnabled', s.manual_payment_approval_enabled,
        'bankTransferInstructions', s.bank_transfer_instructions,
        'minimumTransactionMinor', s.minimum_transaction_minor,
        'maximumTransactionMinor', s.maximum_transaction_minor,
        'allowPartialPayments', s.allow_partial_payments,
        'allowOverpayments', s.allow_overpayments,
        'updatedAt', s.updated_at
      ) from public.agilecert_finance_settings s where s.singleton = true
    ),
    'taxProfiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tax.id, 'code', tax.code, 'name', tax.name,
        'ratePercent', tax.rate_percent, 'countryCode', tax.country_code,
        'registrationNumber', tax.registration_number,
        'isDefault', tax.is_default, 'isActive', tax.is_active
      ) order by tax.is_default desc, tax.name)
      from public.agilecert_tax_profiles tax where tax.is_active = true
    ), '[]'::jsonb),
    'pricingPolicies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', policy.id, 'examinationId', policy.examination_id,
        'examinationTitle', exam.title, 'programmeId', programme.id,
        'programmeCode', programme.code, 'programmeName', programme.name,
        'currency', policy.currency, 'standardAmountMinor', policy.standard_amount_minor,
        'promotionalAmountMinor', policy.promotional_amount_minor,
        'promotionName', policy.promotion_name,
        'promotionStartsAt', policy.promotion_starts_at,
        'promotionEndsAt', policy.promotion_ends_at,
        'accessMode', policy.access_mode, 'attemptsIncluded', policy.attempts_included,
        'retakeAmountMinor', policy.retake_amount_minor,
        'bulkCartEligible', policy.bulk_cart_eligible,
        'isActive', policy.is_active, 'updatedAt', policy.updated_at
      ) order by programme.code, exam.title, policy.currency)
      from public.agilecert_exam_pricing_policies policy
      join public.examinations exam on exam.id = policy.examination_id
      join public.programmes programme on programme.id = exam.programme_id
    ), '[]'::jsonb),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', candidate.id, 'fullName', candidate.full_name, 'email', candidate.email
      ) order by candidate.full_name, candidate.email)
      from public.profiles candidate
      where candidate.role = 'candidate' and candidate.is_active = true
    ), '[]'::jsonb),
    'accessGrants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', grant_row.id, 'candidateId', grant_row.candidate_id,
        'candidateName', profile.full_name, 'candidateEmail', profile.email,
        'examinationId', grant_row.examination_id, 'examinationTitle', exam.title,
        'accessMode', grant_row.access_mode, 'grantCode', grant_row.grant_code,
        'validFrom', grant_row.valid_from, 'validTo', grant_row.valid_to,
        'status', grant_row.status, 'reason', grant_row.reason,
        'createdAt', grant_row.created_at, 'updatedAt', grant_row.updated_at
      ) order by grant_row.created_at desc)
      from (select * from public.agilecert_exam_access_grants order by created_at desc limit v_limit) grant_row
      join public.profiles profile on profile.id = grant_row.candidate_id
      join public.examinations exam on exam.id = grant_row.examination_id
    ), '[]'::jsonb),
    'couponPolicies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'couponId', coupon.id, 'couponCode', upper(coupon.code),
        'minimumAmountMinor', coupon.minimum_amount_minor,
        'minimumModuleCount', coupon.minimum_module_count,
        'allowMultiModuleCart', coupon.allow_multi_module_cart,
        'maximumDiscountMinor', coupon.maximum_discount_minor,
        'maximumRedemptions', coupon.maximum_redemptions,
        'perCandidateLimit', coupon.per_candidate_limit
      ) order by upper(coupon.code))
      from public.coupons coupon
    ), '[]'::jsonb),
    'couponTargets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', target.id, 'couponId', target.coupon_id,
        'couponCode', upper(coupon.code), 'targetType', target.target_type,
        'programmeId', target.programme_id, 'programmeCode', programme.code,
        'programmeName', programme.name, 'examinationId', target.examination_id,
        'examinationTitle', exam.title, 'isActive', target.is_active
      ) order by upper(coupon.code), target.target_type)
      from public.agilecert_coupon_targets target
      join public.coupons coupon on coupon.id = target.coupon_id
      left join public.programmes programme on programme.id = target.programme_id
      left join public.examinations exam on exam.id = target.examination_id
    ), '[]'::jsonb),
    'couponUsage', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', redemption.id, 'couponId', redemption.coupon_id,
        'couponCode', upper(coupon.code), 'candidateId', redemption.candidate_id,
        'candidateName', profile.full_name, 'candidateEmail', profile.email,
        'orderId', order_row.id, 'orderReference', order_row.reference,
        'examinationTitle', exam.title, 'programmeCode', programme.code,
        'currency', order_row.currency, 'discountAmountMinor', redemption.discount_amount_minor,
        'status', redemption.status, 'redeemedAt', redemption.redeemed_at,
        'createdAt', redemption.created_at
      ) order by redemption.created_at desc)
      from (select * from public.coupon_redemptions order by created_at desc limit v_limit) redemption
      join public.coupons coupon on coupon.id = redemption.coupon_id
      join public.profiles profile on profile.id = redemption.candidate_id
      join public.exam_orders order_row on order_row.id = redemption.order_id
      join public.examinations exam on exam.id = order_row.examination_id
      join public.programmes programme on programme.id = exam.programme_id
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(transaction_row.payload order by transaction_row.created_at desc)
      from (
        select order_row.created_at, jsonb_build_object(
          'orderType','exam','orderId',order_row.id,'reference',order_row.reference,
          'candidateId',order_row.candidate_id,'candidateName',profile.full_name,'candidateEmail',profile.email,
          'programmeCode',programme.code,'programmeName',programme.name,
          'examinationTitle',exam.title,'itemCount',1,'currency',order_row.currency,
          'grossAmountMinor',order_row.list_amount_minor,'discountAmountMinor',order_row.discount_amount_minor,
          'payableAmountMinor',order_row.payable_amount_minor,'amountPaidMinor',coalesce(payment.amount_minor,0),
          'couponCode',case when coupon.id is null then null else upper(coupon.code) end,
          'orderStatus',order_row.status,'paymentStatus',payment.status,
          'provider',payment.provider,'providerTransactionId',payment.provider_transaction_id,
          'paidAt',order_row.paid_at,'fulfilledAt',order_row.fulfilled_at,'expiresAt',order_row.expires_at,
          'provisioningStatus',case
            when order_row.status in ('paid','waived') and order_row.fulfilled_at is null then 'paid_unfulfilled'
            when order_row.fulfilled_at is not null then 'fulfilled'
            else 'not_due' end,
          'items', jsonb_build_array(jsonb_build_object(
            'examinationId', exam.id, 'examinationTitle', exam.title,
            'grossAmountMinor', order_row.list_amount_minor,
            'discountAmountMinor', order_row.discount_amount_minor,
            'payableAmountMinor', order_row.payable_amount_minor,
            'status', order_row.status
          )),
          'createdAt',order_row.created_at
        ) payload
        from public.exam_orders order_row
        join public.profiles profile on profile.id = order_row.candidate_id
        join public.examinations exam on exam.id = order_row.examination_id
        join public.programmes programme on programme.id = exam.programme_id
        left join public.coupons coupon on coupon.id = order_row.coupon_id
        left join lateral (
          select * from public.exam_payments pay where pay.order_id = order_row.id
          order by pay.created_at desc limit 1
        ) payment on true
        where not exists (select 1 from public.exam_bulk_order_items item where item.child_order_id = order_row.id)
        union all
        select bulk.created_at, jsonb_build_object(
          'orderType','bulk','orderId',bulk.id,'reference',bulk.reference,
          'candidateId',bulk.candidate_id,'candidateName',profile.full_name,'candidateEmail',profile.email,
          'programmeCode','CIPMN-MOCK','programmeName','CIPMN Module Cart',
          'examinationTitle',bulk.item_count || ' consolidated examinations','itemCount',bulk.item_count,
          'currency',bulk.currency,'grossAmountMinor',bulk.list_amount_minor,
          'discountAmountMinor',bulk.discount_amount_minor,'payableAmountMinor',bulk.payable_amount_minor,
          'amountPaidMinor',coalesce(payment.amount_minor,0),'couponCode',bulk.coupon_code,
          'orderStatus',bulk.status,'paymentStatus',payment.status,'provider',payment.provider,
          'providerTransactionId',payment.provider_transaction_id,'paidAt',bulk.paid_at,
          'fulfilledAt',bulk.fulfilled_at,'expiresAt',bulk.expires_at,
          'provisioningStatus',case
            when bulk.status in ('paid','partially_fulfilled') then 'paid_unfulfilled'
            when bulk.status = 'fulfilled' then 'fulfilled' else 'not_due' end,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'itemId', item.id, 'examinationId', item.examination_id,
              'examinationTitle', item.examination_title,
              'grossAmountMinor', item.list_amount_minor,
              'discountAmountMinor', item.discount_amount_minor,
              'payableAmountMinor', item.payable_amount_minor,
              'status', item.status, 'failureMessage', item.failure_message
            ) order by item.position)
            from public.exam_bulk_order_items item where item.bulk_order_id=bulk.id
          ), '[]'::jsonb),
          'createdAt',bulk.created_at
        ) payload
        from public.exam_bulk_orders bulk
        join public.profiles profile on profile.id = bulk.candidate_id
        left join lateral (
          select * from public.exam_bulk_payments pay where pay.bulk_order_id = bulk.id
          order by pay.created_at desc limit 1
        ) payment on true
      ) transaction_row
      limit v_limit
    ), '[]'::jsonb),
    'recoveryActions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', action_row.id, 'orderType', action_row.order_type,
        'orderId', action_row.order_id, 'reference', action_row.reference,
        'action', action_row.action, 'status', action_row.status,
        'reason', action_row.reason, 'outcome', action_row.outcome,
        'requestedBy', action_row.requested_by, 'requestedAt', action_row.requested_at,
        'processedAt', action_row.processed_at
      ) order by action_row.created_at desc)
      from (select * from public.agilecert_finance_recovery_actions order by created_at desc limit v_limit) action_row
    ), '[]'::jsonb),
    'dashboard', jsonb_build_object(
      'individualOrders', (select count(*) from public.exam_orders where created_at between v_from and v_to and not exists (select 1 from public.exam_bulk_order_items item where item.child_order_id=exam_orders.id)),
      'bulkOrders', (select count(*) from public.exam_bulk_orders where created_at between v_from and v_to),
      'failedTransactions', (
        select count(*) from (
          select id from public.exam_orders where created_at between v_from and v_to and status in ('failed','cancelled','expired')
          union all select id from public.exam_bulk_orders where created_at between v_from and v_to and status in ('failed','cancelled','expired')
        ) failed
      ),
      'unfulfilledOrders', (
        select count(*) from (
          select id from public.exam_orders where created_at between v_from and v_to and status in ('paid','waived') and fulfilled_at is null
          union all select id from public.exam_bulk_orders where created_at between v_from and v_to and status in ('paid','partially_fulfilled')
        ) pending_fulfilment
      ),
      'revenueByCurrency', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', totals.currency, 'grossAmountMinor', totals.gross_amount,
          'discountAmountMinor', totals.discount_amount, 'paidAmountMinor', totals.paid_amount,
          'transactions', totals.transactions
        ) order by totals.currency)
        from (
          select currency, sum(list_amount_minor)::bigint gross_amount,
            sum(discount_amount_minor)::bigint discount_amount,
            sum(payable_amount_minor)::bigint paid_amount, count(*)::integer transactions
          from (
            select currency,list_amount_minor,discount_amount_minor,payable_amount_minor
            from public.exam_orders order_row
            where order_row.created_at between v_from and v_to and order_row.status in ('paid','waived')
              and not exists (select 1 from public.exam_bulk_order_items item where item.child_order_id=order_row.id)
            union all
            select currency,list_amount_minor,discount_amount_minor,payable_amount_minor
            from public.exam_bulk_orders bulk where bulk.created_at between v_from and v_to and bulk.status in ('paid','partially_fulfilled','fulfilled')
          ) paid group by currency
        ) totals
      ), '[]'::jsonb),
      'revenueByProgramme', coalesce((
        select jsonb_agg(jsonb_build_object(
          'programmeCode', grouped.programme_code,'programmeName',grouped.programme_name,
          'currency',grouped.currency,'paidAmountMinor',grouped.paid_amount,'discountAmountMinor',grouped.discount_amount,'orders',grouped.orders
        ) order by grouped.programme_code, grouped.currency)
        from (
          select programme.code programme_code, programme.name programme_name, order_row.currency,
            sum(order_row.payable_amount_minor)::bigint paid_amount,
            sum(order_row.discount_amount_minor)::bigint discount_amount,
            count(*)::integer orders
          from public.exam_orders order_row
          join public.examinations exam on exam.id=order_row.examination_id
          join public.programmes programme on programme.id=exam.programme_id
          where order_row.created_at between v_from and v_to and order_row.status in ('paid','waived')
          group by programme.code, programme.name, order_row.currency
        ) grouped
      ), '[]'::jsonb),
      'revenueByExamination', coalesce((
        select jsonb_agg(jsonb_build_object(
          'examinationId', grouped.examination_id,'examinationTitle',grouped.examination_title,
          'programmeCode',grouped.programme_code,'currency',grouped.currency,
          'paidAmountMinor',grouped.paid_amount,'discountAmountMinor',grouped.discount_amount,'orders',grouped.orders
        ) order by grouped.paid_amount desc)
        from (
          select exam.id examination_id, exam.title examination_title, programme.code programme_code, order_row.currency,
            sum(order_row.payable_amount_minor)::bigint paid_amount,
            sum(order_row.discount_amount_minor)::bigint discount_amount,
            count(*)::integer orders
          from public.exam_orders order_row
          join public.examinations exam on exam.id=order_row.examination_id
          join public.programmes programme on programme.id=exam.programme_id
          where order_row.created_at between v_from and v_to and order_row.status in ('paid','waived')
          group by exam.id, exam.title, programme.code, order_row.currency
        ) grouped
        limit 100
      ), '[]'::jsonb),
      'couponPerformance', coalesce((
        select jsonb_agg(jsonb_build_object(
          'couponCode',upper(coupon.code),'redemptions',count(redemption.id),
          'discountAmountMinor',coalesce(sum(redemption.discount_amount_minor),0),
          'maximumRedemptions',coupon.maximum_redemptions,
          'remainingRedemptions',case when coupon.maximum_redemptions is null then null else greatest(coupon.maximum_redemptions-count(redemption.id),0) end
        ) order by coalesce(sum(redemption.discount_amount_minor),0) desc)
        from public.coupons coupon
        left join public.coupon_redemptions redemption on redemption.coupon_id=coupon.id and redemption.status='redeemed' and redemption.created_at between v_from and v_to
        group by coupon.id, coupon.code, coupon.maximum_redemptions
      ), '[]'::jsonb),
      'dailyPerformance', coalesce((
        select jsonb_agg(jsonb_build_object(
          'date',daily.day,'currency',daily.currency,'paidAmountMinor',daily.paid_amount,'discountAmountMinor',daily.discount_amount,'orders',daily.orders
        ) order by daily.day)
        from (
          select date_trunc('day',created_at)::date day,currency,sum(payable_amount_minor)::bigint paid_amount,sum(discount_amount_minor)::bigint discount_amount,count(*)::integer orders
          from public.exam_orders order_row
          where order_row.created_at between v_from and v_to and order_row.status in ('paid','waived')
          group by date_trunc('day',created_at)::date,currency
        ) daily
      ), '[]'::jsonb),
      'weeklyPerformance', coalesce((
        select jsonb_agg(jsonb_build_object(
          'week',weekly.week,'currency',weekly.currency,'paidAmountMinor',weekly.paid_amount,'discountAmountMinor',weekly.discount_amount,'orders',weekly.orders
        ) order by weekly.week)
        from (
          select to_char(date_trunc('week',created_at),'IYYY-"W"IW') week,currency,sum(payable_amount_minor)::bigint paid_amount,sum(discount_amount_minor)::bigint discount_amount,count(*)::integer orders
          from public.exam_orders order_row
          where order_row.created_at between v_from and v_to and order_row.status in ('paid','waived')
          group by to_char(date_trunc('week',created_at),'IYYY-"W"IW'),currency
        ) weekly
      ), '[]'::jsonb),
      'monthlyPerformance', coalesce((
        select jsonb_agg(jsonb_build_object(
          'month',monthly.month,'currency',monthly.currency,'paidAmountMinor',monthly.paid_amount,'discountAmountMinor',monthly.discount_amount,'orders',monthly.orders
        ) order by monthly.month)
        from (
          select to_char(date_trunc('month',created_at),'YYYY-MM') month,currency,sum(payable_amount_minor)::bigint paid_amount,sum(discount_amount_minor)::bigint discount_amount,count(*)::integer orders
          from public.exam_orders order_row
          where order_row.created_at between v_from and v_to and order_row.status in ('paid','waived')
          group by to_char(date_trunc('month',created_at),'YYYY-MM'),currency
        ) monthly
      ), '[]'::jsonb)
    )
  );
end;
$$;

alter table public.agilecert_exam_pricing_policies enable row level security;
alter table public.agilecert_exam_access_grants enable row level security;
alter table public.agilecert_coupon_targets enable row level security;
alter table public.agilecert_finance_recovery_actions enable row level security;

revoke all on table public.agilecert_exam_pricing_policies from public, anon, authenticated;
revoke all on table public.agilecert_exam_access_grants from public, anon, authenticated;
revoke all on table public.agilecert_coupon_targets from public, anon, authenticated;
revoke all on table public.agilecert_finance_recovery_actions from public, anon, authenticated;

revoke all on function public.finance_apply_due_exam_pricing_for_exam(uuid,text) from public, anon, authenticated;
revoke all on function public.finance_apply_due_exam_pricing_for_cart(text) from public, anon, authenticated;
revoke all on function public.finance_mark_abandoned_orders() from public, anon, authenticated;
revoke all on function public.finance_upsert_exam_pricing_policy(uuid,text,bigint,bigint,text,timestamptz,timestamptz,text,integer,bigint,boolean,boolean,text) from public, anon, authenticated;
revoke all on function public.finance_upsert_exam_access_grant(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.finance_upsert_coupon_advanced(uuid,text,text,text,text,numeric,text,uuid[],uuid[],bigint,integer,boolean,bigint,timestamptz,timestamptz,integer,integer,boolean,text) from public, anon, authenticated;
revoke all on function public.finance_set_coupon_active_audited(uuid,boolean,text) from public, anon, authenticated;
revoke all on function public.finance_upsert_general_settings(text,text[],boolean,text,text,boolean,text,uuid,text,text,integer,integer,boolean,boolean,boolean,text,bigint,bigint,boolean,boolean,text) from public, anon, authenticated;
revoke all on function public.finance_queue_recovery_action(text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.finance_recover_paid_exam_order(uuid,text) from public, anon, authenticated;
revoke all on function public.finance_recover_paid_bulk_order(uuid,text) from public, anon, authenticated;
revoke all on function public.finance_get_receipt_payload(text,uuid) from public, anon, authenticated;
revoke all on function public.finance_record_export(text,integer,jsonb) from public, anon, authenticated;
revoke all on function public.get_finance_console_completion_snapshot(integer,timestamptz,timestamptz) from public, anon, authenticated;

grant execute on function public.finance_apply_due_exam_pricing_for_exam(uuid,text) to authenticated;
grant execute on function public.finance_apply_due_exam_pricing_for_cart(text) to authenticated;
grant execute on function public.finance_mark_abandoned_orders() to authenticated;
grant execute on function public.finance_upsert_exam_pricing_policy(uuid,text,bigint,bigint,text,timestamptz,timestamptz,text,integer,bigint,boolean,boolean,text) to authenticated;
grant execute on function public.finance_upsert_exam_access_grant(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text,text) to authenticated;
grant execute on function public.finance_upsert_coupon_advanced(uuid,text,text,text,text,numeric,text,uuid[],uuid[],bigint,integer,boolean,bigint,timestamptz,timestamptz,integer,integer,boolean,text) to authenticated;
grant execute on function public.finance_set_coupon_active_audited(uuid,boolean,text) to authenticated;
grant execute on function public.finance_upsert_general_settings(text,text[],boolean,text,text,boolean,text,uuid,text,text,integer,integer,boolean,boolean,boolean,text,bigint,bigint,boolean,boolean,text) to authenticated;
grant execute on function public.finance_queue_recovery_action(text,uuid,text,text) to authenticated;
grant execute on function public.finance_recover_paid_exam_order(uuid,text) to authenticated;
grant execute on function public.finance_recover_paid_bulk_order(uuid,text) to authenticated;
grant execute on function public.finance_get_receipt_payload(text,uuid) to authenticated;
grant execute on function public.finance_record_export(text,integer,jsonb) to authenticated;
grant execute on function public.get_finance_console_completion_snapshot(integer,timestamptz,timestamptz) to authenticated;

commit;
