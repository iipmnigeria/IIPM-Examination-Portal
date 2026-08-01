begin;

-- ---------------------------------------------------------------------------
-- Finance Console Examination Administrator activation
--
-- The Finance Console launcher is already mounted through the retained
-- AdminCommerceConsole compatibility alias. Its visibility is controlled by
-- finance.console.view. Establish the approved least-privilege profile
-- explicitly, including correction of any older role grants or revocations.
-- ---------------------------------------------------------------------------

insert into public.agilecert_finance_role_permissions (
  role,
  permission_key,
  is_granted,
  updated_at
)
values
  ('exam_admin', 'finance.console.view', true, now()),
  ('exam_admin', 'finance.dashboard.view', true, now()),
  ('exam_admin', 'finance.receipts.manage', true, now()),
  ('exam_admin', 'finance.exports.download', true, now()),
  ('exam_admin', 'finance.exam_prices.manage', false, now()),
  ('exam_admin', 'finance.certificate_prices.manage', false, now()),
  ('exam_admin', 'finance.coupons.manage', false, now()),
  ('exam_admin', 'finance.orders.manage', false, now()),
  ('exam_admin', 'finance.settings.manage', false, now()),
  ('exam_admin', 'finance.transactions.reconcile', false, now()),
  ('exam_admin', 'finance.access.recover', false, now()),
  ('exam_admin', 'finance.adjustments.approve', false, now()),
  ('exam_admin', 'finance.permissions.manage', false, now())
on conflict (role, permission_key) do update
set is_granted = excluded.is_granted,
    updated_by = null,
    updated_at = excluded.updated_at;

-- Fail the migration if a required permission definition is absent. This keeps
-- activation bound to the completed Finance Console authority rather than
-- silently creating an incomplete role profile.
do $$
begin
  if (
    select count(*)
    from public.agilecert_finance_permission_definitions
    where permission_key in (
      'finance.console.view',
      'finance.dashboard.view',
      'finance.receipts.manage',
      'finance.exports.download',
      'finance.exam_prices.manage',
      'finance.certificate_prices.manage',
      'finance.coupons.manage',
      'finance.orders.manage',
      'finance.settings.manage',
      'finance.transactions.reconcile',
      'finance.access.recover',
      'finance.adjustments.approve',
      'finance.permissions.manage'
    )
      and is_active
  ) <> 13 then
    raise exception 'Finance Console permission definitions are incomplete; least-privilege activation stopped.';
  end if;
end;
$$;

commit;
