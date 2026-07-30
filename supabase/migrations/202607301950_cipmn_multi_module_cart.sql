begin;

-- CIPMN multi-module cart and consolidated examination checkout.
-- Existing single-module exam_orders remain the authoritative child access records.

create table if not exists public.exam_carts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.profiles(id) on delete cascade,
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  coupon_code text,
  last_bulk_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.exam_carts(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, examination_id)
);

create table if not exists public.exam_bulk_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'IIPM-BULK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18))
  ),
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  cart_id uuid references public.exam_carts(id) on delete set null,
  cart_fingerprint text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  coupon_code text,
  item_count integer not null default 0 check (item_count >= 0),
  list_amount_minor bigint not null default 0 check (list_amount_minor >= 0),
  discount_amount_minor bigint not null default 0 check (discount_amount_minor >= 0),
  payable_amount_minor bigint not null default 0 check (payable_amount_minor >= 0),
  status text not null default 'building'
    check (status in (
      'building', 'pending', 'paid', 'partially_fulfilled', 'fulfilled',
      'failed', 'cancelled', 'expired', 'refunded'
    )),
  gateway text not null default 'paystack',
  gateway_authorization_url text,
  gateway_access_code text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_amount_minor <= list_amount_minor),
  check (payable_amount_minor = list_amount_minor - discount_amount_minor)
);

alter table public.exam_carts
  drop constraint if exists exam_carts_last_bulk_order_id_fkey;
alter table public.exam_carts
  add constraint exam_carts_last_bulk_order_id_fkey
  foreign key (last_bulk_order_id) references public.exam_bulk_orders(id) on delete set null;

create table if not exists public.exam_bulk_order_items (
  id uuid primary key default gen_random_uuid(),
  bulk_order_id uuid not null references public.exam_bulk_orders(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  child_order_id uuid unique references public.exam_orders(id) on delete restrict,
  examination_title text not null,
  position integer not null default 0,
  price_id uuid references public.exam_prices(id) on delete restrict,
  coupon_id uuid references public.coupons(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  list_amount_minor bigint not null default 0 check (list_amount_minor >= 0),
  discount_amount_minor bigint not null default 0 check (discount_amount_minor >= 0),
  payable_amount_minor bigint not null default 0 check (payable_amount_minor >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'waived', 'fulfilled', 'already_unlocked', 'failed', 'cancelled')),
  fulfilled_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bulk_order_id, examination_id),
  check (discount_amount_minor <= list_amount_minor),
  check (payable_amount_minor = list_amount_minor - discount_amount_minor)
);

create table if not exists public.exam_bulk_payments (
  id uuid primary key default gen_random_uuid(),
  bulk_order_id uuid not null references public.exam_bulk_orders(id) on delete restrict,
  provider text not null default 'paystack',
  reference text not null,
  provider_transaction_id text,
  status text not null default 'initiated'
    check (status in ('initiated', 'success', 'failed', 'abandoned', 'refunded')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  paid_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, reference)
);

create index if not exists exam_cart_items_cart_idx
  on public.exam_cart_items(cart_id, position, created_at);
create index if not exists exam_bulk_orders_candidate_idx
  on public.exam_bulk_orders(candidate_id, created_at desc);
create index if not exists exam_bulk_orders_pending_idx
  on public.exam_bulk_orders(status, expires_at)
  where status in ('building', 'pending');
create unique index if not exists exam_bulk_orders_candidate_fingerprint_pending_uidx
  on public.exam_bulk_orders(candidate_id, cart_fingerprint)
  where status = 'pending';
create index if not exists exam_bulk_order_items_parent_idx
  on public.exam_bulk_order_items(bulk_order_id, position);
create index if not exists exam_bulk_order_items_child_idx
  on public.exam_bulk_order_items(child_order_id)
  where child_order_id is not null;
create index if not exists exam_bulk_payments_parent_idx
  on public.exam_bulk_payments(bulk_order_id, created_at desc);
create index if not exists exam_bulk_payments_transaction_idx
  on public.exam_bulk_payments(provider_transaction_id)
  where provider_transaction_id is not null;

drop trigger if exists exam_carts_set_updated_at on public.exam_carts;
create trigger exam_carts_set_updated_at
  before update on public.exam_carts
  for each row execute function public.set_updated_at();

drop trigger if exists exam_cart_items_set_updated_at on public.exam_cart_items;
create trigger exam_cart_items_set_updated_at
  before update on public.exam_cart_items
  for each row execute function public.set_updated_at();

drop trigger if exists exam_bulk_orders_set_updated_at on public.exam_bulk_orders;
create trigger exam_bulk_orders_set_updated_at
  before update on public.exam_bulk_orders
  for each row execute function public.set_updated_at();

drop trigger if exists exam_bulk_order_items_set_updated_at on public.exam_bulk_order_items;
create trigger exam_bulk_order_items_set_updated_at
  before update on public.exam_bulk_order_items
  for each row execute function public.set_updated_at();

drop trigger if exists exam_bulk_payments_set_updated_at on public.exam_bulk_payments;
create trigger exam_bulk_payments_set_updated_at
  before update on public.exam_bulk_payments
  for each row execute function public.set_updated_at();

create or replace function public.agilecert_get_or_create_exam_cart(p_candidate_id uuid)
returns public.exam_carts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart public.exam_carts%rowtype;
begin
  insert into public.exam_carts(candidate_id)
  values (p_candidate_id)
  on conflict (candidate_id) do update
  set updated_at = public.exam_carts.updated_at
  returning * into v_cart;

  return v_cart;
end;
$$;

create or replace function public.agilecert_cancel_candidate_pending_bulk_orders(
  p_candidate_id uuid,
  p_reason text default 'cart_changed'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_count integer := 0;
begin
  with cancelled as (
    update public.exam_bulk_orders bulk
    set status = case when bulk.expires_at <= now() then 'expired' else 'cancelled' end,
        metadata = bulk.metadata || jsonb_build_object(
          'cancelReason', coalesce(nullif(trim(p_reason), ''), 'cart_changed'),
          'cancelledAt', now()
        ),
        updated_at = now()
    where bulk.candidate_id = p_candidate_id
      and bulk.status in ('building', 'pending')
    returning bulk.id
  )
  select count(*) into v_parent_count from cancelled;

  update public.exam_orders child
  set status = case when child.expires_at <= now() then 'expired' else 'cancelled' end,
      metadata = child.metadata || jsonb_build_object(
        'bulkCancellationReason', coalesce(nullif(trim(p_reason), ''), 'cart_changed')
      ),
      updated_at = now()
  from public.exam_bulk_order_items item
  join public.exam_bulk_orders bulk on bulk.id = item.bulk_order_id
  where item.child_order_id = child.id
    and bulk.candidate_id = p_candidate_id
    and bulk.status in ('cancelled', 'expired')
    and child.status = 'pending';

  update public.coupon_redemptions redemption
  set status = 'released',
      released_at = coalesce(redemption.released_at, now()),
      updated_at = now()
  from public.exam_orders child
  join public.exam_bulk_order_items item on item.child_order_id = child.id
  join public.exam_bulk_orders bulk on bulk.id = item.bulk_order_id
  where redemption.order_id = child.id
    and bulk.candidate_id = p_candidate_id
    and bulk.status in ('cancelled', 'expired')
    and redemption.status = 'reserved';

  update public.exam_bulk_order_items item
  set status = 'cancelled',
      failure_code = coalesce(item.failure_code, 'bulk_checkout_cancelled'),
      failure_message = coalesce(
        item.failure_message,
        'The pending consolidated checkout was cancelled before payment.'
      ),
      updated_at = now()
  from public.exam_bulk_orders bulk
  where item.bulk_order_id = bulk.id
    and bulk.candidate_id = p_candidate_id
    and bulk.status in ('cancelled', 'expired')
    and item.status = 'pending';

  update public.exam_bulk_payments payment
  set status = 'abandoned',
      updated_at = now()
  from public.exam_bulk_orders bulk
  where payment.bulk_order_id = bulk.id
    and bulk.candidate_id = p_candidate_id
    and bulk.status in ('cancelled', 'expired')
    and payment.status = 'initiated';

  return v_parent_count;
end;
$$;

create or replace function public.get_my_exam_cart()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_cart public.exam_carts%rowtype;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_candidate_id
      and profile.role = 'candidate'
      and profile.is_active = true
  ) then
    raise exception 'Only an active candidate account may use the examination cart.';
  end if;

  v_cart := public.agilecert_get_or_create_exam_cart(v_candidate_id);

  return jsonb_build_object(
    'cartId', v_cart.id,
    'currency', v_cart.currency,
    'couponCode', v_cart.coupon_code,
    'lastBulkOrderId', v_cart.last_bulk_order_id,
    'itemCount', (
      select count(*) from public.exam_cart_items item where item.cart_id = v_cart.id
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'examinationId', exam.id,
          'examinationTitle', exam.title,
          'programmeCode', programme.code,
          'position', item.position,
          'canLaunch', exists (
            select 1
            from public.exam_assignments assignment
            where assignment.examination_id = exam.id
              and assignment.candidate_id = v_candidate_id
              and assignment.status = 'assigned'
              and (assignment.available_from is null or assignment.available_from <= now())
              and (assignment.expires_at is null or assignment.expires_at > now())
          )
        )
        order by item.position, exam.title
      )
      from public.exam_cart_items item
      join public.examinations exam on exam.id = item.examination_id
      join public.programmes programme on programme.id = exam.programme_id
      where item.cart_id = v_cart.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.set_my_exam_cart_item(
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
  v_changed boolean := false;
  v_next_position integer;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_candidate_id
      and profile.role = 'candidate'
      and profile.is_active = true
  ) then
    raise exception 'Only an active candidate account may update the examination cart.';
  end if;

  if not exists (
    select 1
    from public.examinations exam
    join public.programmes programme on programme.id = exam.programme_id
    where exam.id = p_examination_id
      and exam.status = 'published'
      and (exam.starts_at is null or exam.starts_at <= now())
      and (exam.ends_at is null or exam.ends_at > now())
      and programme.code = 'CIPMN-MOCK'
  ) then
    raise exception 'Only an available CIPMN module examination may be added to this cart.';
  end if;

  v_cart := public.agilecert_get_or_create_exam_cart(v_candidate_id);

  if coalesce(p_selected, true) then
    if exists (
      select 1 from public.exam_assignments assignment
      where assignment.examination_id = p_examination_id
        and assignment.candidate_id = v_candidate_id
        and assignment.status = 'assigned'
        and (assignment.available_from is null or assignment.available_from <= now())
        and (assignment.expires_at is null or assignment.expires_at > now())
    ) then
      raise exception 'This examination is already unlocked and cannot be added to the cart.';
    end if;

    if not exists (
      select 1 from public.exam_cart_items item
      where item.cart_id = v_cart.id and item.examination_id = p_examination_id
    ) then
      perform public.agilecert_cancel_candidate_pending_bulk_orders(v_candidate_id, 'cart_item_added');

      update public.exam_orders child
      set status = case when child.expires_at <= now() then 'expired' else 'cancelled' end,
          metadata = child.metadata || jsonb_build_object('supersededBy', 'cipmn_bulk_cart'),
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
      select 1 from public.exam_cart_items item
      where item.cart_id = v_cart.id and item.examination_id = p_examination_id
    ) then
      perform public.agilecert_cancel_candidate_pending_bulk_orders(v_candidate_id, 'cart_item_removed');
      delete from public.exam_cart_items item
      where item.cart_id = v_cart.id and item.examination_id = p_examination_id;
      v_changed := true;
    end if;
  end if;

  if v_changed then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (
      v_candidate_id,
      case when coalesce(p_selected, true) then 'add_exam_cart_item' else 'remove_exam_cart_item' end,
      'exam_cart',
      v_cart.id::text,
      jsonb_build_object('examinationId', p_examination_id)
    );
  end if;

  return public.get_my_exam_cart();
end;
$$;

create or replace function public.configure_my_exam_cart(
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
  v_cart public.exam_carts%rowtype;
  v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'NGN'));
  v_coupon_code text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'A valid three-letter payment currency is required.';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_candidate_id
      and profile.role = 'candidate'
      and profile.is_active = true
  ) then
    raise exception 'Only an active candidate account may configure the examination cart.';
  end if;

  v_cart := public.agilecert_get_or_create_exam_cart(v_candidate_id);

  if v_cart.currency is distinct from v_currency
     or v_cart.coupon_code is distinct from v_coupon_code then
    perform public.agilecert_cancel_candidate_pending_bulk_orders(v_candidate_id, 'cart_pricing_changed');

    update public.exam_carts cart
    set currency = v_currency,
        coupon_code = v_coupon_code,
        updated_at = now()
    where cart.id = v_cart.id
    returning * into v_cart;

    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (
      v_candidate_id,
      'configure_exam_cart',
      'exam_cart',
      v_cart.id::text,
      jsonb_build_object('currency', v_currency, 'couponCode', v_coupon_code)
    );
  end if;

  return public.get_my_exam_cart();
end;
$$;

create or replace function public.quote_my_exam_cart(
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
  v_cart public.exam_carts%rowtype;
  v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'NGN'));
  v_coupon_code text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  v_item record;
  v_quote record;
  v_items jsonb := '[]'::jsonb;
  v_list_total bigint := 0;
  v_discount_total bigint := 0;
  v_payable_total bigint := 0;
  v_quoted_count integer := 0;
  v_unlocked_count integer := 0;
  v_coupon_id uuid;
  v_coupon public.coupons%rowtype;
  v_existing_global integer := 0;
  v_existing_candidate integer := 0;
  v_fingerprint text;
  v_existing_bulk public.exam_bulk_orders%rowtype;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  perform public.configure_my_exam_cart(v_currency, v_coupon_code);
  select * into v_cart from public.exam_carts where candidate_id = v_candidate_id;

  if not exists (select 1 from public.exam_cart_items item where item.cart_id = v_cart.id) then
    raise exception 'Select at least one CIPMN module before requesting a cart quote.';
  end if;

  select md5(
    v_candidate_id::text || '|' || v_currency || '|' || coalesce(v_coupon_code, '') || '|' ||
    coalesce(string_agg(item.examination_id::text, ',' order by item.examination_id::text), '')
  )
  into v_fingerprint
  from public.exam_cart_items item
  where item.cart_id = v_cart.id;

  select * into v_existing_bulk
  from public.exam_bulk_orders bulk
  where bulk.candidate_id = v_candidate_id
    and bulk.cart_fingerprint = v_fingerprint
    and bulk.status = 'pending'
    and bulk.expires_at > now()
  order by bulk.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'cartId', v_cart.id,
      'cartFingerprint', v_fingerprint,
      'bulkOrderId', v_existing_bulk.id,
      'reference', v_existing_bulk.reference,
      'currency', v_existing_bulk.currency,
      'couponCode', v_existing_bulk.coupon_code,
      'itemCount', v_existing_bulk.item_count,
      'quotedItemCount', (
        select count(*) from public.exam_bulk_order_items item
        where item.bulk_order_id = v_existing_bulk.id
          and item.status not in ('already_unlocked', 'cancelled')
      ),
      'alreadyUnlockedCount', (
        select count(*) from public.exam_bulk_order_items item
        where item.bulk_order_id = v_existing_bulk.id
          and item.status = 'already_unlocked'
      ),
      'listAmountMinor', v_existing_bulk.list_amount_minor,
      'discountAmountMinor', v_existing_bulk.discount_amount_minor,
      'payableAmountMinor', v_existing_bulk.payable_amount_minor,
      'status', 'existing_order',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'examinationId', item.examination_id,
          'examinationTitle', item.examination_title,
          'position', item.position,
          'status', item.status,
          'priceId', item.price_id,
          'couponId', item.coupon_id,
          'currency', item.currency,
          'listAmountMinor', item.list_amount_minor,
          'discountAmountMinor', item.discount_amount_minor,
          'payableAmountMinor', item.payable_amount_minor
        ) order by item.position)
        from public.exam_bulk_order_items item
        where item.bulk_order_id = v_existing_bulk.id
      ), '[]'::jsonb)
    );
  end if;

  for v_item in
    select item.position, exam.id as examination_id, exam.title, programme.code as programme_code
    from public.exam_cart_items item
    join public.examinations exam on exam.id = item.examination_id
    join public.programmes programme on programme.id = exam.programme_id
    where item.cart_id = v_cart.id
      and programme.code = 'CIPMN-MOCK'
    order by item.position, exam.title
  loop
    if exists (
      select 1 from public.exam_assignments assignment
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

    select * into v_quote
    from public.resolve_exam_purchase_quote(
      v_item.examination_id,
      v_candidate_id,
      v_currency,
      v_coupon_code
    );

    if v_coupon_id is null then
      v_coupon_id := v_quote.coupon_id;
    elsif v_quote.coupon_id is distinct from v_coupon_id then
      raise exception 'The selected modules cannot be combined under one coupon.';
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

  if v_quoted_count = 0 and v_unlocked_count > 0 then
    return jsonb_build_object(
      'cartId', v_cart.id,
      'cartFingerprint', v_fingerprint,
      'currency', v_currency,
      'couponCode', v_coupon_code,
      'itemCount', jsonb_array_length(v_items),
      'quotedItemCount', 0,
      'alreadyUnlockedCount', v_unlocked_count,
      'listAmountMinor', 0,
      'discountAmountMinor', 0,
      'payableAmountMinor', 0,
      'status', 'already_unlocked',
      'items', v_items
    );
  end if;

  if v_coupon_id is not null then
    select * into v_coupon from public.coupons coupon where coupon.id = v_coupon_id;

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
    'status', case when v_payable_total = 0 then 'waived' else 'quoted' end,
    'items', v_items
  );
end;
$$;

create or replace function public.agilecert_exam_bulk_order_payload(
  p_bulk_order_id uuid,
  p_candidate_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'bulkOrderId', bulk.id,
    'reference', bulk.reference,
    'cartId', bulk.cart_id,
    'currency', bulk.currency,
    'couponCode', bulk.coupon_code,
    'itemCount', bulk.item_count,
    'listAmountMinor', bulk.list_amount_minor,
    'discountAmountMinor', bulk.discount_amount_minor,
    'payableAmountMinor', bulk.payable_amount_minor,
    'status', bulk.status,
    'paymentRequired', bulk.payable_amount_minor > 0 and bulk.status = 'pending',
    'authorizationUrl', bulk.gateway_authorization_url,
    'accessCode', bulk.gateway_access_code,
    'expiresAt', bulk.expires_at,
    'paidAt', bulk.paid_at,
    'fulfilledAt', bulk.fulfilled_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'itemId', item.id,
        'examinationId', item.examination_id,
        'examinationTitle', item.examination_title,
        'childOrderId', item.child_order_id,
        'position', item.position,
        'currency', item.currency,
        'listAmountMinor', item.list_amount_minor,
        'discountAmountMinor', item.discount_amount_minor,
        'payableAmountMinor', item.payable_amount_minor,
        'status', item.status,
        'fulfilledAt', item.fulfilled_at,
        'failureCode', item.failure_code,
        'failureMessage', item.failure_message
      ) order by item.position, item.examination_title)
      from public.exam_bulk_order_items item
      where item.bulk_order_id = bulk.id
    ), '[]'::jsonb),
    'paymentStatus', (
      select payment.status
      from public.exam_bulk_payments payment
      where payment.bulk_order_id = bulk.id
      order by payment.created_at desc
      limit 1
    )
  )
  from public.exam_bulk_orders bulk
  where bulk.id = p_bulk_order_id
    and bulk.candidate_id = p_candidate_id;
$$;

create or replace function public.create_my_exam_bulk_order(
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
  v_cart public.exam_carts%rowtype;
  v_quote jsonb;
  v_fingerprint text;
  v_existing public.exam_bulk_orders%rowtype;
  v_bulk public.exam_bulk_orders%rowtype;
  v_item jsonb;
  v_child jsonb;
  v_child_order public.exam_orders%rowtype;
  v_position integer := 0;
  v_item_count integer := 0;
  v_list_total bigint := 0;
  v_discount_total bigint := 0;
  v_payable_total bigint := 0;
  v_pending_count integer := 0;
  v_status text;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('exam-bulk:' || v_candidate_id::text));

  if not public.agilecert_candidate_profile_is_complete(v_candidate_id) then
    raise exception 'Complete your mandatory candidate profile before purchasing or starting an examination.';
  end if;

  perform public.configure_my_exam_cart(p_currency, p_coupon_code);
  select * into v_cart from public.exam_carts where candidate_id = v_candidate_id;

  if not exists (
    select 1 from public.exam_cart_items item where item.cart_id = v_cart.id
  ) then
    raise exception 'Select at least one CIPMN module before creating a consolidated order.';
  end if;

  select md5(
    v_candidate_id::text || '|' || v_cart.currency || '|' || coalesce(v_cart.coupon_code, '') || '|' ||
    coalesce(string_agg(item.examination_id::text, ',' order by item.examination_id::text), '')
  )
  into v_fingerprint
  from public.exam_cart_items item
  where item.cart_id = v_cart.id;

  select * into v_existing
  from public.exam_bulk_orders bulk
  where bulk.candidate_id = v_candidate_id
    and bulk.cart_fingerprint = v_fingerprint
    and bulk.status = 'pending'
    and bulk.expires_at > now()
  order by bulk.created_at desc
  limit 1;

  if found then
    return public.agilecert_exam_bulk_order_payload(v_existing.id, v_candidate_id);
  end if;

  perform public.agilecert_cancel_candidate_pending_bulk_orders(v_candidate_id, 'new_bulk_checkout');

  -- A cart checkout supersedes any uncompleted individual checkout for its modules.
  update public.exam_orders child
  set status = case when child.expires_at <= now() then 'expired' else 'cancelled' end,
      metadata = child.metadata || jsonb_build_object('supersededBy', 'cipmn_bulk_cart'),
      updated_at = now()
  where child.candidate_id = v_candidate_id
    and child.status = 'pending'
    and child.examination_id in (
      select item.examination_id from public.exam_cart_items item where item.cart_id = v_cart.id
    );

  update public.coupon_redemptions redemption
  set status = 'released',
      released_at = coalesce(redemption.released_at, now()),
      updated_at = now()
  from public.exam_orders child
  where redemption.order_id = child.id
    and child.candidate_id = v_candidate_id
    and child.status in ('cancelled', 'expired')
    and child.examination_id in (
      select item.examination_id from public.exam_cart_items item where item.cart_id = v_cart.id
    )
    and redemption.status = 'reserved';

  v_quote := public.quote_my_exam_cart(v_cart.currency, v_cart.coupon_code);

  insert into public.exam_bulk_orders(
    candidate_id, cart_id, cart_fingerprint, currency, coupon_code,
    status, expires_at, metadata
  ) values (
    v_candidate_id,
    v_cart.id,
    v_fingerprint,
    v_quote ->> 'currency',
    nullif(v_quote ->> 'couponCode', ''),
    'building',
    now() + interval '30 minutes',
    jsonb_build_object('source', 'candidate_cipmn_cart')
  )
  returning * into v_bulk;

  for v_item in select value from jsonb_array_elements(v_quote -> 'items')
  loop
    v_position := v_position + 1;
    v_item_count := v_item_count + 1;

    if v_item ->> 'status' = 'already_unlocked' then
      insert into public.exam_bulk_order_items(
        bulk_order_id, examination_id, examination_title, position,
        currency, list_amount_minor, discount_amount_minor, payable_amount_minor,
        status, fulfilled_at
      ) values (
        v_bulk.id,
        (v_item ->> 'examinationId')::uuid,
        v_item ->> 'examinationTitle',
        v_position,
        v_quote ->> 'currency',
        0, 0, 0,
        'already_unlocked',
        now()
      );
      continue;
    end if;

    v_child := public.create_exam_order(
      (v_item ->> 'examinationId')::uuid,
      v_quote ->> 'currency',
      nullif(v_quote ->> 'couponCode', '')
    );

    if v_child ->> 'status' = 'already_unlocked' then
      insert into public.exam_bulk_order_items(
        bulk_order_id, examination_id, examination_title, position,
        currency, list_amount_minor, discount_amount_minor, payable_amount_minor,
        status, fulfilled_at
      ) values (
        v_bulk.id,
        (v_item ->> 'examinationId')::uuid,
        v_item ->> 'examinationTitle',
        v_position,
        v_quote ->> 'currency',
        0, 0, 0,
        'already_unlocked',
        now()
      );
      continue;
    end if;

    select * into v_child_order
    from public.exam_orders child
    where child.id = (v_child ->> 'orderId')::uuid
      and child.candidate_id = v_candidate_id
    for update;

    if not found then
      raise exception 'A child examination order could not be created for %.', v_item ->> 'examinationTitle';
    end if;

    update public.exam_orders child
    set metadata = child.metadata || jsonb_build_object(
      'bulkOrderId', v_bulk.id,
      'bulkReference', v_bulk.reference,
      'bulkItemPosition', v_position
    ),
    gateway_authorization_url = null,
    gateway_access_code = null,
    updated_at = now()
    where child.id = v_child_order.id;

    insert into public.exam_bulk_order_items(
      bulk_order_id, examination_id, child_order_id, examination_title, position,
      price_id, coupon_id, currency, list_amount_minor, discount_amount_minor,
      payable_amount_minor, status, fulfilled_at
    ) values (
      v_bulk.id,
      v_child_order.examination_id,
      v_child_order.id,
      v_item ->> 'examinationTitle',
      v_position,
      v_child_order.price_id,
      v_child_order.coupon_id,
      v_child_order.currency,
      v_child_order.list_amount_minor,
      v_child_order.discount_amount_minor,
      v_child_order.payable_amount_minor,
      case when v_child_order.status = 'waived' then 'waived' else 'pending' end,
      case when v_child_order.status = 'waived' then v_child_order.fulfilled_at else null end
    );

    v_list_total := v_list_total + v_child_order.list_amount_minor;
    v_discount_total := v_discount_total + v_child_order.discount_amount_minor;
    v_payable_total := v_payable_total + v_child_order.payable_amount_minor;
    if v_child_order.status = 'pending' then
      v_pending_count := v_pending_count + 1;
    end if;
  end loop;

  v_status := case when v_pending_count = 0 then 'fulfilled' else 'pending' end;

  update public.exam_bulk_orders bulk
  set item_count = v_item_count,
      list_amount_minor = v_list_total,
      discount_amount_minor = v_discount_total,
      payable_amount_minor = v_payable_total,
      status = v_status,
      fulfilled_at = case when v_status = 'fulfilled' then now() else null end,
      updated_at = now()
  where bulk.id = v_bulk.id
  returning * into v_bulk;

  update public.exam_carts cart
  set last_bulk_order_id = v_bulk.id,
      updated_at = now()
  where cart.id = v_cart.id;

  if v_status = 'fulfilled' then
    delete from public.exam_cart_items cart_item
    using public.exam_bulk_order_items order_item
    where order_item.bulk_order_id = v_bulk.id
      and cart_item.cart_id = v_cart.id
      and cart_item.examination_id = order_item.examination_id;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_candidate_id,
    'create_exam_bulk_order',
    'exam_bulk_order',
    v_bulk.id::text,
    jsonb_build_object(
      'reference', v_bulk.reference,
      'itemCount', v_bulk.item_count,
      'currency', v_bulk.currency,
      'listAmountMinor', v_bulk.list_amount_minor,
      'discountAmountMinor', v_bulk.discount_amount_minor,
      'payableAmountMinor', v_bulk.payable_amount_minor,
      'status', v_bulk.status
    )
  );

  return public.agilecert_exam_bulk_order_payload(v_bulk.id, v_candidate_id);
end;
$$;

create or replace function public.get_my_exam_bulk_orders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_order_id uuid;
  v_orders jsonb := '[]'::jsonb;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  for v_order_id in
    select bulk.id
    from public.exam_bulk_orders bulk
    where bulk.candidate_id = v_candidate_id
    order by bulk.created_at desc
    limit 25
  loop
    v_orders := v_orders || jsonb_build_array(
      public.agilecert_exam_bulk_order_payload(v_order_id, v_candidate_id)
    );
  end loop;

  return jsonb_build_object('orders', v_orders);
end;
$$;

create or replace function public.fulfil_paid_exam_bulk_order(
  p_bulk_order_id uuid,
  p_provider_transaction_id text,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bulk public.exam_bulk_orders%rowtype;
  v_item public.exam_bulk_order_items%rowtype;
  v_child_result jsonb;
  v_failed_count integer := 0;
  v_pending_count integer := 0;
  v_fulfilled_count integer := 0;
  v_final_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_exam_admin() then
    raise exception 'Only the verified payment service or an examination administrator may fulfil a bulk order.';
  end if;

  select * into v_bulk
  from public.exam_bulk_orders bulk
  where bulk.id = p_bulk_order_id
  for update;

  if not found then
    raise exception 'The consolidated examination order was not found.';
  end if;

  if v_bulk.status = 'fulfilled' and v_bulk.fulfilled_at is not null then
    return public.agilecert_exam_bulk_order_payload(v_bulk.id, v_bulk.candidate_id);
  end if;

  if v_bulk.status not in ('pending', 'paid', 'partially_fulfilled') then
    raise exception 'This consolidated order cannot be fulfilled from status %.', v_bulk.status;
  end if;

  if v_bulk.payable_amount_minor <= 0 then
    raise exception 'This consolidated order does not require a paid fulfilment.';
  end if;

  insert into public.exam_bulk_payments(
    bulk_order_id, provider, reference, provider_transaction_id,
    status, amount_minor, currency, paid_at, provider_payload
  ) values (
    v_bulk.id,
    'paystack',
    v_bulk.reference,
    nullif(trim(p_provider_transaction_id), ''),
    'success',
    v_bulk.payable_amount_minor,
    v_bulk.currency,
    now(),
    coalesce(p_provider_payload, '{}'::jsonb)
  )
  on conflict (provider, reference) do update
  set provider_transaction_id = excluded.provider_transaction_id,
      status = 'success',
      amount_minor = excluded.amount_minor,
      currency = excluded.currency,
      paid_at = coalesce(public.exam_bulk_payments.paid_at, excluded.paid_at),
      provider_payload = excluded.provider_payload,
      updated_at = now();

  update public.exam_bulk_orders bulk
  set status = 'paid',
      paid_at = coalesce(bulk.paid_at, now()),
      updated_at = now()
  where bulk.id = v_bulk.id
  returning * into v_bulk;

  for v_item in
    select item.*
    from public.exam_bulk_order_items item
    where item.bulk_order_id = v_bulk.id
      and item.status in ('pending', 'failed')
      and item.child_order_id is not null
    order by item.position
    for update
  loop
    begin
      v_child_result := public.fulfil_paid_exam_order(
        v_item.child_order_id,
        p_provider_transaction_id,
        coalesce(p_provider_payload, '{}'::jsonb) || jsonb_build_object(
          'bulkOrderId', v_bulk.id,
          'bulkReference', v_bulk.reference,
          'childOrderId', v_item.child_order_id,
          'allocatedAmountMinor', v_item.payable_amount_minor
        )
      );

      update public.exam_bulk_order_items item
      set status = 'fulfilled',
          fulfilled_at = coalesce(item.fulfilled_at, now()),
          failure_code = null,
          failure_message = null,
          metadata = item.metadata || jsonb_build_object('childFulfilment', v_child_result),
          updated_at = now()
      where item.id = v_item.id;
    exception
      when others then
        update public.exam_bulk_order_items item
        set status = 'failed',
            failure_code = 'child_fulfilment_failed',
            failure_message = left(sqlerrm, 1000),
            updated_at = now()
        where item.id = v_item.id;
    end;
  end loop;

  select
    count(*) filter (where item.status = 'failed'),
    count(*) filter (where item.status = 'pending'),
    count(*) filter (where item.status in ('fulfilled', 'waived', 'already_unlocked'))
  into v_failed_count, v_pending_count, v_fulfilled_count
  from public.exam_bulk_order_items item
  where item.bulk_order_id = v_bulk.id;

  v_final_status := case
    when v_failed_count = 0 and v_pending_count = 0 then 'fulfilled'
    else 'partially_fulfilled'
  end;

  update public.exam_bulk_orders bulk
  set status = v_final_status,
      fulfilled_at = case
        when v_final_status = 'fulfilled' then coalesce(bulk.fulfilled_at, now())
        else bulk.fulfilled_at
      end,
      metadata = bulk.metadata || jsonb_build_object(
        'fulfilledItemCount', v_fulfilled_count,
        'failedItemCount', v_failed_count,
        'pendingItemCount', v_pending_count,
        'lastFulfilmentAttemptAt', now()
      ),
      updated_at = now()
  where bulk.id = v_bulk.id
  returning * into v_bulk;

  delete from public.exam_cart_items cart_item
  using public.exam_bulk_order_items order_item
  where order_item.bulk_order_id = v_bulk.id
    and order_item.status in ('fulfilled', 'waived', 'already_unlocked')
    and cart_item.examination_id = order_item.examination_id
    and cart_item.cart_id = v_bulk.cart_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case when v_final_status = 'fulfilled'
      then 'fulfil_exam_bulk_order'
      else 'partially_fulfil_exam_bulk_order'
    end,
    'exam_bulk_order',
    v_bulk.id::text,
    jsonb_build_object(
      'reference', v_bulk.reference,
      'providerTransactionId', nullif(trim(p_provider_transaction_id), ''),
      'fulfilledItemCount', v_fulfilled_count,
      'failedItemCount', v_failed_count,
      'pendingItemCount', v_pending_count,
      'status', v_final_status
    )
  );

  return public.agilecert_exam_bulk_order_payload(v_bulk.id, v_bulk.candidate_id);
end;
$$;

alter table public.exam_carts enable row level security;
alter table public.exam_cart_items enable row level security;
alter table public.exam_bulk_orders enable row level security;
alter table public.exam_bulk_order_items enable row level security;
alter table public.exam_bulk_payments enable row level security;

revoke all on public.exam_carts from public, anon, authenticated;
revoke all on public.exam_cart_items from public, anon, authenticated;
revoke all on public.exam_bulk_orders from public, anon, authenticated;
revoke all on public.exam_bulk_order_items from public, anon, authenticated;
revoke all on public.exam_bulk_payments from public, anon, authenticated;

revoke all on function public.agilecert_get_or_create_exam_cart(uuid) from public, anon, authenticated;
revoke all on function public.agilecert_cancel_candidate_pending_bulk_orders(uuid, text) from public, anon, authenticated;
revoke all on function public.agilecert_exam_bulk_order_payload(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_my_exam_cart() from public, anon, authenticated;
revoke all on function public.set_my_exam_cart_item(uuid, boolean) from public, anon, authenticated;
revoke all on function public.configure_my_exam_cart(text, text) from public, anon, authenticated;
revoke all on function public.quote_my_exam_cart(text, text) from public, anon, authenticated;
revoke all on function public.create_my_exam_bulk_order(text, text) from public, anon, authenticated;
revoke all on function public.get_my_exam_bulk_orders() from public, anon, authenticated;
revoke all on function public.fulfil_paid_exam_bulk_order(uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.get_my_exam_cart() to authenticated;
grant execute on function public.set_my_exam_cart_item(uuid, boolean) to authenticated;
grant execute on function public.configure_my_exam_cart(text, text) to authenticated;
grant execute on function public.quote_my_exam_cart(text, text) to authenticated;
grant execute on function public.create_my_exam_bulk_order(text, text) to authenticated;
grant execute on function public.get_my_exam_bulk_orders() to authenticated;
grant execute on function public.fulfil_paid_exam_bulk_order(uuid, text, jsonb) to authenticated, service_role;

comment on table public.exam_bulk_orders is
  'Parent record for one consolidated candidate payment covering multiple authoritative child exam_orders.';
comment on table public.exam_bulk_order_items is
  'Immutable checkout allocation linking each consolidated order item to its existing single-module exam_order.';
comment on function public.fulfil_paid_exam_bulk_order(uuid, text, jsonb) is
  'Idempotently allocates one verified Paystack transaction across child examination orders and retries partial fulfilment safely.';

commit;
