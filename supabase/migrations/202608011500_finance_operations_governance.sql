begin;

-- ---------------------------------------------------------------------------
-- Finance Operations and Governance Enhancement
--
-- Adds maker-checker finance cases, immutable decisions and notes, operational
-- alerts, and scheduled management-report queueing. Existing order, payment,
-- Paystack verification, fulfilment, receipt and certificate authorities remain
-- unchanged and authoritative.
-- ---------------------------------------------------------------------------

insert into public.agilecert_finance_permission_definitions (
  permission_key, name, description, category, risk_level
) values
  ('finance.governance.view', 'View Finance Governance', 'View finance operations cases, alerts, report schedules and management oversight summaries.', 'governance', 'standard'),
  ('finance.cases.submit', 'Submit Finance Cases', 'Submit reconciliation, recovery, refund, reversal, manual-payment and adjustment cases for independent review.', 'governance', 'sensitive'),
  ('finance.cases.review', 'Review Finance Cases', 'Assign, approve, reject and record execution of finance operations cases under maker-checker control.', 'governance', 'restricted'),
  ('finance.alerts.manage', 'Manage Finance Alerts', 'Configure finance alert rules, run alert scans and resolve operational alerts.', 'governance', 'restricted'),
  ('finance.reports.schedule', 'Schedule Finance Reports', 'Create management-report schedules and queue due finance summaries through the controlled communications outbox.', 'governance', 'sensitive')
on conflict (permission_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  risk_level = excluded.risk_level,
  is_active = true,
  updated_at = now();

-- Examination Administrators may see governance and submit cases. Independent
-- review, alert administration and scheduled-report administration remain
-- ungranted until a Super Administrator explicitly delegates them.
insert into public.agilecert_finance_role_permissions(role, permission_key, is_granted)
values
  ('exam_admin', 'finance.governance.view', true),
  ('exam_admin', 'finance.cases.submit', true),
  ('exam_admin', 'finance.cases.review', false),
  ('exam_admin', 'finance.alerts.manage', false),
  ('exam_admin', 'finance.reports.schedule', false)
on conflict (role, permission_key) do update set
  is_granted = excluded.is_granted,
  updated_by = null,
  updated_at = now();

create table public.agilecert_finance_operation_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  case_type text not null check (case_type in (
    'reconciliation', 'manual_payment', 'access_recovery', 'refund',
    'reversal', 'adjustment', 'exception'
  )),
  order_type text check (order_type is null or order_type in ('exam', 'bulk', 'certificate', 'other')),
  order_id uuid,
  reference text,
  candidate_id uuid references public.profiles(id),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  title text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  status text not null default 'submitted' check (status in (
    'submitted', 'in_review', 'approved', 'rejected', 'executed', 'cancelled'
  )),
  required_approvals integer not null default 1 check (required_approvals between 1 and 2),
  requested_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  due_at timestamptz not null,
  resolved_at timestamptz,
  outcome jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((order_id is null and order_type is null) or (order_id is not null and order_type is not null))
);

create index agilecert_finance_operation_cases_status_idx
  on public.agilecert_finance_operation_cases(status, priority, due_at);
create index agilecert_finance_operation_cases_reference_idx
  on public.agilecert_finance_operation_cases(reference, created_at desc);
create index agilecert_finance_operation_cases_requester_idx
  on public.agilecert_finance_operation_cases(requested_by, created_at desc);

create table public.agilecert_finance_operation_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.agilecert_finance_operation_cases(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'note', 'assigned', 'approved', 'rejected', 'executed',
    'cancelled', 'status_changed', 'alert_linked'
  )),
  actor_id uuid references public.profiles(id),
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index agilecert_finance_case_events_case_idx
  on public.agilecert_finance_operation_case_events(case_id, created_at);
create unique index agilecert_finance_case_approval_actor_uidx
  on public.agilecert_finance_operation_case_events(case_id, actor_id)
  where event_type = 'approved' and actor_id is not null;

create table public.agilecert_finance_alert_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique check (rule_code in (
    'overdue_case', 'pending_approval', 'paid_unfulfilled', 'failed_recovery'
  )),
  name text not null,
  description text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  threshold_hours integer not null default 24 check (threshold_hours between 0 and 2160),
  threshold_count integer not null default 1 check (threshold_count between 1 and 100000),
  recipient_ids uuid[] not null default '{}'::uuid[],
  email_enabled boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agilecert_finance_alerts (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.agilecert_finance_alert_rules(id) on delete cascade,
  fingerprint text not null unique,
  entity_type text not null,
  entity_id text not null,
  reference text,
  title text not null,
  message text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'suppressed')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_note text,
  last_notified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agilecert_finance_alerts_status_idx
  on public.agilecert_finance_alerts(status, severity, last_seen_at desc);
create index agilecert_finance_alerts_entity_idx
  on public.agilecert_finance_alerts(entity_type, entity_id);

create table public.agilecert_finance_report_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  report_type text not null check (report_type in (
    'revenue_summary', 'transaction_exceptions', 'coupon_performance',
    'reconciliation_backlog', 'governance_cases'
  )),
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  day_of_week integer check (day_of_week is null or day_of_week between 0 and 6),
  day_of_month integer check (day_of_month is null or day_of_month between 1 and 28),
  run_time time not null default '08:00',
  timezone text not null default 'Africa/Lagos',
  recipient_ids uuid[] not null,
  subject text not null,
  is_active boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(recipient_ids) between 1 and 50),
  check (
    (cadence = 'daily')
    or (cadence = 'weekly' and day_of_week is not null)
    or (cadence = 'monthly' and day_of_month is not null)
  )
);

create index agilecert_finance_report_schedules_due_idx
  on public.agilecert_finance_report_schedules(is_active, next_run_at);

create table public.agilecert_finance_report_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.agilecert_finance_report_schedules(id) on delete cascade,
  scheduled_for timestamptz not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null check (status in ('queued', 'partial', 'failed', 'skipped')),
  recipient_count integer not null default 0,
  queued_count integer not null default 0,
  error_message text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (schedule_id, scheduled_for)
);

create index agilecert_finance_report_runs_schedule_idx
  on public.agilecert_finance_report_runs(schedule_id, created_at desc);

create trigger agilecert_finance_operation_cases_set_updated_at
  before update on public.agilecert_finance_operation_cases
  for each row execute function public.set_updated_at();
create trigger agilecert_finance_alert_rules_set_updated_at
  before update on public.agilecert_finance_alert_rules
  for each row execute function public.set_updated_at();
create trigger agilecert_finance_alerts_set_updated_at
  before update on public.agilecert_finance_alerts
  for each row execute function public.set_updated_at();
create trigger agilecert_finance_report_schedules_set_updated_at
  before update on public.agilecert_finance_report_schedules
  for each row execute function public.set_updated_at();

create or replace function public.agilecert_block_finance_case_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Finance case events are immutable.';
end;
$$;

create trigger agilecert_finance_case_events_immutable
  before update or delete on public.agilecert_finance_operation_case_events
  for each row execute function public.agilecert_block_finance_case_event_mutation();

insert into public.agilecert_finance_alert_rules (
  rule_code, name, description, severity, threshold_hours, threshold_count
) values
  ('overdue_case', 'Overdue finance case', 'A finance operations case has passed its service deadline without resolution.', 'high', 0, 1),
  ('pending_approval', 'Pending finance approval', 'A submitted or in-review finance case has waited beyond the configured approval window.', 'medium', 24, 1),
  ('paid_unfulfilled', 'Paid but unfulfilled order', 'A successful or waived order remains unfulfilled beyond the configured window.', 'critical', 2, 1),
  ('failed_recovery', 'Failed paid-access recovery', 'A controlled finance recovery action ended in a failed state.', 'high', 0, 1)
on conflict (rule_code) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

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
    'canViewGovernance', public.agilecert_has_finance_permission('finance.governance.view'),
    'canSubmitCases', public.agilecert_has_finance_permission('finance.cases.submit'),
    'canReviewCases', public.agilecert_has_finance_permission('finance.cases.review'),
    'canManageAlerts', public.agilecert_has_finance_permission('finance.alerts.manage'),
    'canScheduleReports', public.agilecert_has_finance_permission('finance.reports.schedule'),
    'canManagePermissions', public.agilecert_has_finance_permission('finance.permissions.manage')
  );
end;
$$;

create or replace function public.finance_next_report_run(
  p_cadence text,
  p_day_of_week integer,
  p_day_of_month integer,
  p_run_time time,
  p_timezone text,
  p_after timestamptz default now()
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_local_after timestamp;
  v_candidate timestamp;
  v_candidate_date date;
  v_target_month date;
  v_last_day integer;
  v_days_ahead integer;
begin
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Select a valid report time zone.';
  end if;

  v_local_after := coalesce(p_after, now()) at time zone p_timezone;

  if p_cadence = 'daily' then
    v_candidate := v_local_after::date + p_run_time;
    if v_candidate <= v_local_after then v_candidate := v_candidate + interval '1 day'; end if;
  elsif p_cadence = 'weekly' then
    if p_day_of_week is null or p_day_of_week not between 0 and 6 then
      raise exception 'Weekly schedules require a day of week from 0 to 6.';
    end if;
    v_days_ahead := (p_day_of_week - extract(dow from v_local_after)::integer + 7) % 7;
    v_candidate := (v_local_after::date + v_days_ahead) + p_run_time;
    if v_candidate <= v_local_after then v_candidate := v_candidate + interval '7 days'; end if;
  elsif p_cadence = 'monthly' then
    if p_day_of_month is null or p_day_of_month not between 1 and 28 then
      raise exception 'Monthly schedules require a day of month from 1 to 28.';
    end if;
    v_target_month := date_trunc('month', v_local_after)::date;
    v_last_day := extract(day from (v_target_month + interval '1 month - 1 day'))::integer;
    v_candidate_date := make_date(
      extract(year from v_target_month)::integer,
      extract(month from v_target_month)::integer,
      least(p_day_of_month, v_last_day)
    );
    v_candidate := v_candidate_date + p_run_time;
    if v_candidate <= v_local_after then
      v_target_month := (v_target_month + interval '1 month')::date;
      v_last_day := extract(day from (v_target_month + interval '1 month - 1 day'))::integer;
      v_candidate_date := make_date(
        extract(year from v_target_month)::integer,
        extract(month from v_target_month)::integer,
        least(p_day_of_month, v_last_day)
      );
      v_candidate := v_candidate_date + p_run_time;
    end if;
  else
    raise exception 'Report cadence must be daily, weekly or monthly.';
  end if;

  return v_candidate at time zone p_timezone;
end;
$$;

create or replace function public.finance_create_operation_case(
  p_case_type text,
  p_title text,
  p_description text,
  p_priority text default 'normal',
  p_order_type text default null,
  p_order_id uuid default null,
  p_reference text default null,
  p_candidate_id uuid default null,
  p_currency text default null,
  p_amount_minor bigint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_case_id uuid := gen_random_uuid();
  v_case_type text := lower(trim(coalesce(p_case_type, '')));
  v_priority text := lower(trim(coalesce(p_priority, 'normal')));
  v_order_type text := nullif(lower(trim(coalesce(p_order_type, ''))), '');
  v_currency text := nullif(upper(trim(coalesce(p_currency, ''))), '');
  v_case_number text;
  v_required integer;
  v_due_at timestamptz;
  v_record public.agilecert_finance_operation_cases%rowtype;
begin
  if not public.agilecert_has_finance_permission('finance.cases.submit') then
    raise exception 'This account does not have permission to submit finance cases.';
  end if;
  if v_case_type not in ('reconciliation','manual_payment','access_recovery','refund','reversal','adjustment','exception') then
    raise exception 'Select a supported finance case type.';
  end if;
  if length(trim(coalesce(p_title, ''))) < 5 then raise exception 'Enter a case title of at least five characters.'; end if;
  if length(trim(coalesce(p_description, ''))) < 10 then raise exception 'Enter a case description of at least ten characters.'; end if;
  if v_priority not in ('low','normal','high','critical') then raise exception 'Select a valid case priority.'; end if;
  if (p_order_id is null) <> (v_order_type is null) then raise exception 'Order type and order ID must be provided together.'; end if;
  if v_order_type is not null and v_order_type not in ('exam','bulk','certificate','other') then raise exception 'Select a valid order type.'; end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must contain three uppercase letters.'; end if;
  if p_amount_minor is not null and p_amount_minor < 0 then raise exception 'Case amount cannot be negative.'; end if;

  v_required := case when v_case_type in ('manual_payment','refund','reversal','adjustment') then 2 else 1 end;
  v_due_at := now() + case v_priority
    when 'critical' then interval '4 hours'
    when 'high' then interval '24 hours'
    when 'low' then interval '120 hours'
    else interval '48 hours'
  end;
  v_case_number := 'FNC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(v_case_id::text, '-', ''), 1, 8));

  insert into public.agilecert_finance_operation_cases(
    id, case_number, case_type, order_type, order_id, reference,
    candidate_id, currency, amount_minor, title, description, priority,
    status, required_approvals, requested_by, submitted_at, due_at, metadata
  ) values (
    v_case_id, v_case_number, v_case_type, v_order_type, p_order_id,
    nullif(trim(coalesce(p_reference, '')), ''), p_candidate_id, v_currency,
    p_amount_minor, trim(p_title), trim(p_description), v_priority,
    'submitted', v_required, v_actor, now(), v_due_at, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_record;

  insert into public.agilecert_finance_operation_case_events(
    case_id, event_type, actor_id, to_status, note, metadata
  ) values (
    v_case_id, 'created', v_actor, 'submitted', trim(p_description),
    jsonb_build_object('caseNumber', v_case_number, 'requiredApprovals', v_required)
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor, 'submit_finance_operation_case', 'finance_operation_case', v_case_id::text,
    jsonb_build_object('caseNumber', v_case_number, 'caseType', v_case_type,
      'priority', v_priority, 'requiredApprovals', v_required, 'reference', v_record.reference)
  );

  return jsonb_build_object(
    'id', v_record.id, 'caseNumber', v_record.case_number,
    'status', v_record.status, 'requiredApprovals', v_record.required_approvals,
    'dueAt', v_record.due_at
  );
end;
$$;

create or replace function public.finance_add_operation_case_note(
  p_case_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_note text := trim(coalesce(p_note, ''));
begin
  if not public.agilecert_has_finance_permission('finance.governance.view') then
    raise exception 'This account does not have permission to view finance governance.';
  end if;
  if length(v_note) < 3 then raise exception 'Enter a note of at least three characters.'; end if;
  if not exists (select 1 from public.agilecert_finance_operation_cases where id = p_case_id) then
    raise exception 'The selected finance case was not found.';
  end if;

  insert into public.agilecert_finance_operation_case_events(case_id, event_type, actor_id, note)
  values (p_case_id, 'note', v_actor, v_note);

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'add_finance_case_note', 'finance_operation_case', p_case_id::text, jsonb_build_object('noteLength', length(v_note)));

  return jsonb_build_object('recorded', true, 'caseId', p_case_id);
end;
$$;

create or replace function public.finance_assign_operation_case(
  p_case_id uuid,
  p_assigned_to uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_case public.agilecert_finance_operation_cases%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not public.agilecert_has_finance_permission('finance.cases.review') then
    raise exception 'This account does not have permission to assign finance cases.';
  end if;
  if length(v_reason) < 5 then raise exception 'Enter an assignment reason of at least five characters.'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_assigned_to and is_active = true and role in ('auditor','exam_admin','super_admin')
  ) then raise exception 'Assign the case to an active staff account.'; end if;

  select * into v_case from public.agilecert_finance_operation_cases where id = p_case_id for update;
  if not found then raise exception 'The selected finance case was not found.'; end if;
  if v_case.status in ('rejected','executed','cancelled') then raise exception 'A closed finance case cannot be reassigned.'; end if;

  update public.agilecert_finance_operation_cases
  set assigned_to = p_assigned_to,
      status = case when status = 'submitted' then 'in_review' else status end
  where id = p_case_id;

  insert into public.agilecert_finance_operation_case_events(
    case_id, event_type, actor_id, from_status, to_status, note, metadata
  ) values (
    p_case_id, 'assigned', v_actor, v_case.status,
    case when v_case.status = 'submitted' then 'in_review' else v_case.status end,
    v_reason, jsonb_build_object('assignedTo', p_assigned_to)
  );

  return jsonb_build_object('assigned', true, 'caseId', p_case_id, 'assignedTo', p_assigned_to);
end;
$$;

create or replace function public.finance_decide_operation_case(
  p_case_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_case public.agilecert_finance_operation_cases%rowtype;
  v_approvals integer := 0;
  v_status text;
begin
  if not public.agilecert_has_finance_permission('finance.cases.review') then
    raise exception 'This account does not have permission to review finance cases.';
  end if;
  if v_decision not in ('approve','reject') then raise exception 'Decision must be approve or reject.'; end if;
  if length(v_reason) < 5 then raise exception 'Enter a decision reason of at least five characters.'; end if;

  select * into v_case from public.agilecert_finance_operation_cases where id = p_case_id for update;
  if not found then raise exception 'The selected finance case was not found.'; end if;
  if v_case.status not in ('submitted','in_review') then raise exception 'Only a submitted or in-review case may be decided.'; end if;
  if v_case.requested_by = v_actor then raise exception 'Maker-checker control prevents the requester from deciding this case.'; end if;

  if v_decision = 'reject' then
    update public.agilecert_finance_operation_cases
    set status = 'rejected', resolved_at = now()
    where id = p_case_id;
    insert into public.agilecert_finance_operation_case_events(
      case_id, event_type, actor_id, from_status, to_status, note
    ) values (p_case_id, 'rejected', v_actor, v_case.status, 'rejected', v_reason);
    v_status := 'rejected';
  else
    if exists (
      select 1 from public.agilecert_finance_operation_case_events
      where case_id = p_case_id and event_type = 'approved' and actor_id = v_actor
    ) then raise exception 'This reviewer has already approved the case.'; end if;

    insert into public.agilecert_finance_operation_case_events(
      case_id, event_type, actor_id, from_status, note
    ) values (p_case_id, 'approved', v_actor, v_case.status, v_reason);

    select count(*)::integer into v_approvals
    from public.agilecert_finance_operation_case_events
    where case_id = p_case_id and event_type = 'approved';

    v_status := case when v_approvals >= v_case.required_approvals then 'approved' else 'in_review' end;
    update public.agilecert_finance_operation_cases
    set status = v_status,
        assigned_to = coalesce(assigned_to, v_actor)
    where id = p_case_id;

    insert into public.agilecert_finance_operation_case_events(
      case_id, event_type, actor_id, from_status, to_status, note, metadata
    ) values (
      p_case_id, 'status_changed', v_actor, v_case.status, v_status,
      case when v_status = 'approved' then 'Required independent approvals completed.' else 'Additional independent approval is required.' end,
      jsonb_build_object('approvalCount', v_approvals, 'requiredApprovals', v_case.required_approvals)
    );
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor, 'decide_finance_operation_case', 'finance_operation_case', p_case_id::text,
    jsonb_build_object('decision', v_decision, 'status', v_status, 'reason', v_reason,
      'approvalCount', v_approvals, 'requiredApprovals', v_case.required_approvals)
  );

  return jsonb_build_object(
    'caseId', p_case_id, 'decision', v_decision, 'status', v_status,
    'approvalCount', v_approvals, 'requiredApprovals', v_case.required_approvals
  );
end;
$$;

create or replace function public.finance_execute_operation_case(
  p_case_id uuid,
  p_outcome jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_case public.agilecert_finance_operation_cases%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not public.agilecert_has_finance_permission('finance.cases.review') then
    raise exception 'This account does not have permission to record finance case execution.';
  end if;
  if length(v_reason) < 5 then raise exception 'Enter an execution reason of at least five characters.'; end if;

  select * into v_case from public.agilecert_finance_operation_cases where id = p_case_id for update;
  if not found then raise exception 'The selected finance case was not found.'; end if;
  if v_case.status <> 'approved' then raise exception 'Only an approved finance case may be marked executed.'; end if;
  if v_case.requested_by = v_actor then raise exception 'The requester cannot record execution of the same finance case.'; end if;

  update public.agilecert_finance_operation_cases
  set status = 'executed', resolved_at = now(), outcome = coalesce(p_outcome, '{}'::jsonb)
  where id = p_case_id;

  insert into public.agilecert_finance_operation_case_events(
    case_id, event_type, actor_id, from_status, to_status, note, metadata
  ) values (
    p_case_id, 'executed', v_actor, 'approved', 'executed', v_reason,
    jsonb_build_object('outcome', coalesce(p_outcome, '{}'::jsonb))
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor, 'execute_finance_operation_case', 'finance_operation_case', p_case_id::text,
    jsonb_build_object('reason', v_reason, 'outcome', coalesce(p_outcome, '{}'::jsonb))
  );

  return jsonb_build_object('caseId', p_case_id, 'status', 'executed');
end;
$$;

create or replace function public.finance_cancel_operation_case(
  p_case_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_case public.agilecert_finance_operation_cases%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  select * into v_case from public.agilecert_finance_operation_cases where id = p_case_id for update;
  if not found then raise exception 'The selected finance case was not found.'; end if;
  if v_case.requested_by <> v_actor and not public.agilecert_has_finance_permission('finance.cases.review') then
    raise exception 'Only the requester or an authorised reviewer may cancel this case.';
  end if;
  if v_case.status not in ('submitted','in_review') then raise exception 'Only an unresolved finance case may be cancelled.'; end if;
  if length(v_reason) < 5 then raise exception 'Enter a cancellation reason of at least five characters.'; end if;

  update public.agilecert_finance_operation_cases
  set status = 'cancelled', resolved_at = now()
  where id = p_case_id;
  insert into public.agilecert_finance_operation_case_events(
    case_id, event_type, actor_id, from_status, to_status, note
  ) values (p_case_id, 'cancelled', v_actor, v_case.status, 'cancelled', v_reason);

  return jsonb_build_object('caseId', p_case_id, 'status', 'cancelled');
end;
$$;

create or replace function public.finance_update_alert_rule(
  p_rule_code text,
  p_severity text,
  p_threshold_hours integer,
  p_threshold_count integer,
  p_recipient_ids uuid[],
  p_email_enabled boolean,
  p_is_active boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := lower(trim(coalesce(p_rule_code, '')));
  v_severity text := lower(trim(coalesce(p_severity, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_invalid integer;
begin
  if not public.agilecert_has_finance_permission('finance.alerts.manage') then
    raise exception 'This account does not have permission to manage finance alerts.';
  end if;
  if v_severity not in ('low','medium','high','critical') then raise exception 'Select a valid alert severity.'; end if;
  if coalesce(p_threshold_hours, -1) not between 0 and 2160 then raise exception 'Alert threshold hours must be between 0 and 2160.'; end if;
  if coalesce(p_threshold_count, 0) not between 1 and 100000 then raise exception 'Alert threshold count must be at least one.'; end if;
  if length(v_reason) < 5 then raise exception 'Enter an alert-rule change reason of at least five characters.'; end if;
  if not exists (select 1 from public.agilecert_finance_alert_rules where rule_code = v_code) then
    raise exception 'The selected finance alert rule was not found.';
  end if;

  select count(*)::integer into v_invalid
  from unnest(coalesce(p_recipient_ids, '{}'::uuid[])) recipient_id
  left join public.profiles profile on profile.id = recipient_id
  where profile.id is null or not profile.is_active or profile.role = 'candidate';
  if v_invalid > 0 then raise exception 'Alert recipients must be active staff accounts.'; end if;
  if coalesce(p_email_enabled, false) and cardinality(coalesce(p_recipient_ids, '{}'::uuid[])) = 0 then
    raise exception 'Email-enabled alerts require at least one staff recipient.';
  end if;

  update public.agilecert_finance_alert_rules
  set severity = v_severity,
      threshold_hours = p_threshold_hours,
      threshold_count = p_threshold_count,
      recipient_ids = coalesce(p_recipient_ids, '{}'::uuid[]),
      email_enabled = coalesce(p_email_enabled, false),
      is_active = coalesce(p_is_active, true),
      updated_by = v_actor
  where rule_code = v_code;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor, 'update_finance_alert_rule', 'finance_alert_rule', v_code,
    jsonb_build_object('severity', v_severity, 'thresholdHours', p_threshold_hours,
      'thresholdCount', p_threshold_count, 'emailEnabled', p_email_enabled,
      'isActive', p_is_active, 'reason', v_reason)
  );

  return jsonb_build_object('ruleCode', v_code, 'updated', true);
end;
$$;

create or replace function public.finance_scan_governance_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_rows integer := 0;
  v_total integer := 0;
  v_resolved integer := 0;
  v_queued integer := 0;
  v_alert record;
  v_recipient record;
  v_outbox_id uuid;
begin
  if not public.agilecert_has_finance_permission('finance.alerts.manage') then
    raise exception 'This account does not have permission to run finance alert scans.';
  end if;

  insert into public.agilecert_finance_alerts(
    rule_id, fingerprint, entity_type, entity_id, reference, title, message, severity, metadata
  )
  select rule.id, 'overdue-case:' || case_row.id::text || ':' || extract(epoch from case_row.due_at)::bigint,
    'finance_operation_case', case_row.id::text, case_row.case_number,
    'Overdue finance case ' || case_row.case_number,
    case_row.title || ' passed its deadline at ' || to_char(case_row.due_at, 'YYYY-MM-DD HH24:MI TZ'),
    rule.severity, jsonb_build_object('caseType', case_row.case_type, 'priority', case_row.priority, 'dueAt', case_row.due_at)
  from public.agilecert_finance_alert_rules rule
  join public.agilecert_finance_operation_cases case_row
    on rule.rule_code = 'overdue_case'
   and case_row.status in ('submitted','in_review','approved')
   and case_row.due_at < now()
  where rule.is_active
  on conflict (fingerprint) do update set
    last_seen_at = now(), title = excluded.title, message = excluded.message,
    severity = excluded.severity,
    status = case when public.agilecert_finance_alerts.status = 'resolved' then 'open' else public.agilecert_finance_alerts.status end,
    resolved_by = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_by end,
    resolved_at = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_at end,
    resolution_note = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolution_note end,
    metadata = excluded.metadata;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  insert into public.agilecert_finance_alerts(
    rule_id, fingerprint, entity_type, entity_id, reference, title, message, severity, metadata
  )
  select rule.id, 'pending-approval:' || case_row.id::text || ':' || extract(epoch from case_row.submitted_at)::bigint,
    'finance_operation_case', case_row.id::text, case_row.case_number,
    'Finance approval waiting: ' || case_row.case_number,
    case_row.title || ' has waited for approval since ' || to_char(case_row.submitted_at, 'YYYY-MM-DD HH24:MI TZ'),
    rule.severity, jsonb_build_object('requiredApprovals', case_row.required_approvals, 'submittedAt', case_row.submitted_at)
  from public.agilecert_finance_alert_rules rule
  join public.agilecert_finance_operation_cases case_row
    on rule.rule_code = 'pending_approval'
   and case_row.status in ('submitted','in_review')
   and case_row.submitted_at <= now() - make_interval(hours => rule.threshold_hours)
  where rule.is_active
  on conflict (fingerprint) do update set
    last_seen_at = now(), title = excluded.title, message = excluded.message,
    severity = excluded.severity,
    status = case when public.agilecert_finance_alerts.status = 'resolved' then 'open' else public.agilecert_finance_alerts.status end,
    resolved_by = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_by end,
    resolved_at = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_at end,
    resolution_note = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolution_note end,
    metadata = excluded.metadata;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  insert into public.agilecert_finance_alerts(
    rule_id, fingerprint, entity_type, entity_id, reference, title, message, severity, metadata
  )
  select rule.id, 'paid-unfulfilled:exam:' || order_row.id::text,
    'exam_order', order_row.id::text, order_row.reference,
    'Paid examination order awaiting fulfilment',
    order_row.reference || ' remains unfulfilled after successful or waived payment.',
    rule.severity, jsonb_build_object('orderType', 'exam', 'currency', order_row.currency,
      'amountMinor', order_row.payable_amount_minor, 'paidAt', order_row.paid_at)
  from public.agilecert_finance_alert_rules rule
  join public.exam_orders order_row
    on rule.rule_code = 'paid_unfulfilled'
   and order_row.status in ('paid','waived')
   and order_row.fulfilled_at is null
   and coalesce(order_row.paid_at, order_row.created_at) <= now() - make_interval(hours => rule.threshold_hours)
  where rule.is_active
  on conflict (fingerprint) do update set
    last_seen_at = now(), title = excluded.title, message = excluded.message,
    severity = excluded.severity,
    status = case when public.agilecert_finance_alerts.status = 'resolved' then 'open' else public.agilecert_finance_alerts.status end,
    resolved_by = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_by end,
    resolved_at = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_at end,
    resolution_note = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolution_note end,
    metadata = excluded.metadata;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  insert into public.agilecert_finance_alerts(
    rule_id, fingerprint, entity_type, entity_id, reference, title, message, severity, metadata
  )
  select rule.id, 'paid-unfulfilled:bulk:' || order_row.id::text,
    'exam_bulk_order', order_row.id::text, order_row.reference,
    'Paid consolidated order awaiting fulfilment',
    order_row.reference || ' remains wholly or partly unfulfilled after payment.',
    rule.severity, jsonb_build_object('orderType', 'bulk', 'currency', order_row.currency,
      'amountMinor', order_row.payable_amount_minor, 'paidAt', order_row.paid_at)
  from public.agilecert_finance_alert_rules rule
  join public.exam_bulk_orders order_row
    on rule.rule_code = 'paid_unfulfilled'
   and order_row.status in ('paid','partially_fulfilled')
   and order_row.fulfilled_at is null
   and coalesce(order_row.paid_at, order_row.created_at) <= now() - make_interval(hours => rule.threshold_hours)
  where rule.is_active
  on conflict (fingerprint) do update set
    last_seen_at = now(), title = excluded.title, message = excluded.message,
    severity = excluded.severity,
    status = case when public.agilecert_finance_alerts.status = 'resolved' then 'open' else public.agilecert_finance_alerts.status end,
    resolved_by = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_by end,
    resolved_at = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_at end,
    resolution_note = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolution_note end,
    metadata = excluded.metadata;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  insert into public.agilecert_finance_alerts(
    rule_id, fingerprint, entity_type, entity_id, reference, title, message, severity, metadata
  )
  select rule.id, 'failed-recovery:' || recovery.id::text,
    'finance_recovery_action', recovery.id::text, recovery.reference,
    'Finance recovery action failed',
    recovery.reference || ' failed during ' || replace(recovery.action, '_', ' ') || '.',
    rule.severity, jsonb_build_object('action', recovery.action, 'failedAt', recovery.processed_at, 'outcome', recovery.outcome)
  from public.agilecert_finance_alert_rules rule
  join public.agilecert_finance_recovery_actions recovery
    on rule.rule_code = 'failed_recovery' and recovery.status = 'failed'
  where rule.is_active
  on conflict (fingerprint) do update set
    last_seen_at = now(), title = excluded.title, message = excluded.message,
    severity = excluded.severity,
    status = case when public.agilecert_finance_alerts.status = 'resolved' then 'open' else public.agilecert_finance_alerts.status end,
    resolved_by = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_by end,
    resolved_at = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolved_at end,
    resolution_note = case when public.agilecert_finance_alerts.status = 'resolved' then null else public.agilecert_finance_alerts.resolution_note end,
    metadata = excluded.metadata;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  update public.agilecert_finance_alerts alert_row
  set status = 'resolved', resolved_at = now(), resolution_note = 'The monitored condition is no longer present.'
  where alert_row.status in ('open','acknowledged')
    and (
      (alert_row.entity_type = 'finance_operation_case' and not exists (
        select 1 from public.agilecert_finance_operation_cases case_row
        where case_row.id::text = alert_row.entity_id
          and case_row.status in ('submitted','in_review','approved')
          and (
            alert_row.fingerprint like 'overdue-case:%' and case_row.due_at < now()
            or alert_row.fingerprint like 'pending-approval:%' and case_row.status in ('submitted','in_review')
          )
      ))
      or (alert_row.entity_type = 'exam_order' and not exists (
        select 1 from public.exam_orders order_row
        where order_row.id::text = alert_row.entity_id
          and order_row.status in ('paid','waived') and order_row.fulfilled_at is null
      ))
      or (alert_row.entity_type = 'exam_bulk_order' and not exists (
        select 1 from public.exam_bulk_orders order_row
        where order_row.id::text = alert_row.entity_id
          and order_row.status in ('paid','partially_fulfilled') and order_row.fulfilled_at is null
      ))
      or (alert_row.entity_type = 'finance_recovery_action' and not exists (
        select 1 from public.agilecert_finance_recovery_actions recovery
        where recovery.id::text = alert_row.entity_id and recovery.status = 'failed'
      ))
    );
  get diagnostics v_resolved = row_count;

  for v_alert in
    select alert_row.*, rule.recipient_ids
    from public.agilecert_finance_alerts alert_row
    join public.agilecert_finance_alert_rules rule on rule.id = alert_row.rule_id
    where alert_row.status = 'open'
      and alert_row.last_notified_at is null
      and rule.is_active and rule.email_enabled
      and cardinality(rule.recipient_ids) > 0
  loop
    for v_recipient in
      select profile.id, profile.email, profile.full_name
      from public.profiles profile
      where profile.id = any(v_alert.recipient_ids)
        and profile.is_active = true and profile.role <> 'candidate'
    loop
      v_outbox_id := null;
      insert into public.agilecert_communication_outbox(
        candidate_id, recipient_email, recipient_email_hash, message_type, category,
        event_key, due_at, status, subject, payload
      ) values (
        v_recipient.id, lower(trim(v_recipient.email)),
        encode(extensions.digest(lower(trim(v_recipient.email)), 'sha256'), 'hex'),
        'admin_message', 'operational',
        'finance-alert:' || v_alert.id::text || ':' || v_recipient.id::text,
        now(), 'queued', '[Finance Alert] ' || v_alert.title,
        jsonb_build_object(
          'subject', '[Finance Alert] ' || v_alert.title,
          'body', v_alert.message || E'\n\nReference: ' || coalesce(v_alert.reference, v_alert.entity_id),
          'recipientName', v_recipient.full_name,
          'groupLabel', 'Finance Governance Alerts',
          'senderId', v_actor,
          'senderName', 'AgileCert Finance Governance'
        )
      ) on conflict do nothing returning id into v_outbox_id;
      if v_outbox_id is not null then
        insert into public.agilecert_communication_events(outbox_id, candidate_id, event_type, metadata)
        values (v_outbox_id, v_recipient.id, 'queued', jsonb_build_object('source', 'finance_governance_alert'));
        v_queued := v_queued + 1;
      end if;
    end loop;
    update public.agilecert_finance_alerts set last_notified_at = now() where id = v_alert.id;
  end loop;

  insert into public.audit_logs(actor_id, action, entity_type, metadata)
  values (v_actor, 'scan_finance_governance_alerts', 'finance_alert_scan',
    jsonb_build_object('matched', v_total, 'resolved', v_resolved, 'emailsQueued', v_queued));

  return jsonb_build_object('matched', v_total, 'resolved', v_resolved, 'emailsQueued', v_queued);
end;
$$;

create or replace function public.finance_update_alert_status(
  p_alert_id uuid,
  p_status text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_note text := trim(coalesce(p_note, ''));
begin
  if not public.agilecert_has_finance_permission('finance.governance.view') then
    raise exception 'This account does not have permission to view finance governance.';
  end if;
  if v_status not in ('acknowledged','resolved','suppressed') then raise exception 'Select acknowledged, resolved or suppressed.'; end if;
  if v_status in ('resolved','suppressed') and not public.agilecert_has_finance_permission('finance.alerts.manage') then
    raise exception 'Only an alert manager may resolve or suppress finance alerts.';
  end if;
  if length(v_note) < 3 then raise exception 'Enter a status note of at least three characters.'; end if;

  update public.agilecert_finance_alerts
  set status = v_status,
      acknowledged_by = case when v_status = 'acknowledged' then v_actor else acknowledged_by end,
      acknowledged_at = case when v_status = 'acknowledged' then now() else acknowledged_at end,
      resolved_by = case when v_status in ('resolved','suppressed') then v_actor else resolved_by end,
      resolved_at = case when v_status in ('resolved','suppressed') then now() else resolved_at end,
      resolution_note = v_note
  where id = p_alert_id;
  if not found then raise exception 'The selected finance alert was not found.'; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'update_finance_alert_status', 'finance_alert', p_alert_id::text,
    jsonb_build_object('status', v_status, 'note', v_note));

  return jsonb_build_object('alertId', p_alert_id, 'status', v_status);
end;
$$;

create or replace function public.finance_upsert_report_schedule(
  p_schedule_id uuid,
  p_name text,
  p_report_type text,
  p_cadence text,
  p_day_of_week integer,
  p_day_of_month integer,
  p_run_time time,
  p_timezone text,
  p_recipient_ids uuid[],
  p_subject text,
  p_is_active boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_report_type text := lower(trim(coalesce(p_report_type, '')));
  v_cadence text := lower(trim(coalesce(p_cadence, '')));
  v_timezone text := trim(coalesce(p_timezone, 'Africa/Lagos'));
  v_reason text := trim(coalesce(p_reason, ''));
  v_invalid integer;
  v_id uuid := coalesce(p_schedule_id, gen_random_uuid());
  v_next timestamptz;
begin
  if not public.agilecert_has_finance_permission('finance.reports.schedule') then
    raise exception 'This account does not have permission to schedule finance reports.';
  end if;
  if length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Enter a report schedule name.'; end if;
  if v_report_type not in ('revenue_summary','transaction_exceptions','coupon_performance','reconciliation_backlog','governance_cases') then
    raise exception 'Select a supported finance report type.';
  end if;
  if v_cadence not in ('daily','weekly','monthly') then raise exception 'Report cadence must be daily, weekly or monthly.'; end if;
  if length(trim(coalesce(p_subject, ''))) < 3 then raise exception 'Enter a report email subject.'; end if;
  if cardinality(coalesce(p_recipient_ids, '{}'::uuid[])) not between 1 and 50 then raise exception 'Select between one and fifty staff recipients.'; end if;
  if length(v_reason) < 5 then raise exception 'Enter a schedule change reason of at least five characters.'; end if;

  select count(*)::integer into v_invalid
  from unnest(p_recipient_ids) recipient_id
  left join public.profiles profile on profile.id = recipient_id
  where profile.id is null or not profile.is_active or profile.role = 'candidate';
  if v_invalid > 0 then raise exception 'Report recipients must be active staff accounts.'; end if;

  v_next := public.finance_next_report_run(
    v_cadence, p_day_of_week, p_day_of_month,
    coalesce(p_run_time, '08:00'::time), v_timezone, now()
  );

  insert into public.agilecert_finance_report_schedules(
    id, name, report_type, cadence, day_of_week, day_of_month, run_time,
    timezone, recipient_ids, subject, is_active, next_run_at, created_by, updated_by
  ) values (
    v_id, trim(p_name), v_report_type, v_cadence,
    case when v_cadence = 'weekly' then p_day_of_week else null end,
    case when v_cadence = 'monthly' then p_day_of_month else null end,
    coalesce(p_run_time, '08:00'::time), v_timezone, p_recipient_ids,
    trim(p_subject), coalesce(p_is_active, true), v_next, v_actor, v_actor
  )
  on conflict (id) do update set
    name = excluded.name,
    report_type = excluded.report_type,
    cadence = excluded.cadence,
    day_of_week = excluded.day_of_week,
    day_of_month = excluded.day_of_month,
    run_time = excluded.run_time,
    timezone = excluded.timezone,
    recipient_ids = excluded.recipient_ids,
    subject = excluded.subject,
    is_active = excluded.is_active,
    next_run_at = excluded.next_run_at,
    updated_by = v_actor;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor, 'upsert_finance_report_schedule', 'finance_report_schedule', v_id::text,
    jsonb_build_object('name', trim(p_name), 'reportType', v_report_type,
      'cadence', v_cadence, 'nextRunAt', v_next, 'recipientCount', cardinality(p_recipient_ids),
      'isActive', p_is_active, 'reason', v_reason)
  );

  return jsonb_build_object('id', v_id, 'nextRunAt', v_next, 'isActive', coalesce(p_is_active, true));
end;
$$;

create or replace function public.finance_process_due_report_schedules(
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_schedule record;
  v_recipient record;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_exam_orders integer;
  v_bulk_orders integer;
  v_failed_payments integer;
  v_open_cases integer;
  v_open_alerts integer;
  v_revenue_text text;
  v_body text;
  v_outbox_id uuid;
  v_recipient_count integer;
  v_queued_count integer;
  v_processed integer := 0;
  v_queued integer := 0;
  v_run_status text;
begin
  if not public.agilecert_has_finance_permission('finance.reports.schedule') then
    raise exception 'This account does not have permission to process scheduled finance reports.';
  end if;

  for v_schedule in
    select * from public.agilecert_finance_report_schedules
    where is_active and next_run_at <= now()
    order by next_run_at
    for update skip locked
    limit v_limit
  loop
    v_period_end := v_schedule.next_run_at;
    v_period_start := case v_schedule.cadence
      when 'daily' then v_period_end - interval '1 day'
      when 'weekly' then v_period_end - interval '7 days'
      else v_period_end - interval '1 month'
    end;

    select count(*)::integer into v_exam_orders
    from public.exam_orders
    where created_at >= v_period_start and created_at < v_period_end
      and status in ('paid','waived');
    select count(*)::integer into v_bulk_orders
    from public.exam_bulk_orders
    where created_at >= v_period_start and created_at < v_period_end
      and status in ('paid','partially_fulfilled','fulfilled');
    select (
      (select count(*) from public.exam_payments where created_at >= v_period_start and created_at < v_period_end and status = 'failed')
      + (select count(*) from public.exam_bulk_payments where created_at >= v_period_start and created_at < v_period_end and status = 'failed')
    )::integer into v_failed_payments;
    select count(*)::integer into v_open_cases
    from public.agilecert_finance_operation_cases where status in ('submitted','in_review','approved');
    select count(*)::integer into v_open_alerts
    from public.agilecert_finance_alerts where status in ('open','acknowledged');

    select coalesce(string_agg(currency || ' ' || amount_minor::text, ', ' order by currency), 'No paid revenue')
    into v_revenue_text
    from (
      select currency, sum(amount_minor)::bigint amount_minor
      from (
        select currency, payable_amount_minor amount_minor
        from public.exam_orders
        where created_at >= v_period_start and created_at < v_period_end and status in ('paid','waived')
        union all
        select currency, payable_amount_minor
        from public.exam_bulk_orders
        where created_at >= v_period_start and created_at < v_period_end and status in ('paid','partially_fulfilled','fulfilled')
      ) revenue_rows
      group by currency
    ) totals;

    v_body := 'Finance management report: ' || v_schedule.name || E'\n'
      || 'Period: ' || to_char(v_period_start at time zone v_schedule.timezone, 'YYYY-MM-DD HH24:MI')
      || ' to ' || to_char(v_period_end at time zone v_schedule.timezone, 'YYYY-MM-DD HH24:MI')
      || ' (' || v_schedule.timezone || ')' || E'\n\n'
      || 'Revenue by currency (minor units): ' || v_revenue_text || E'\n'
      || 'Paid/waived individual orders: ' || v_exam_orders || E'\n'
      || 'Paid consolidated orders: ' || v_bulk_orders || E'\n'
      || 'Failed payment records: ' || v_failed_payments || E'\n'
      || 'Open governance cases: ' || v_open_cases || E'\n'
      || 'Open operational alerts: ' || v_open_alerts || E'\n\n'
      || 'Open the protected Finance Console for complete transaction-level details and audited actions.';

    v_recipient_count := 0;
    v_queued_count := 0;
    for v_recipient in
      select profile.id, profile.email, profile.full_name
      from public.profiles profile
      where profile.id = any(v_schedule.recipient_ids)
        and profile.is_active and profile.role <> 'candidate'
    loop
      v_recipient_count := v_recipient_count + 1;
      v_outbox_id := null;
      insert into public.agilecert_communication_outbox(
        candidate_id, recipient_email, recipient_email_hash, message_type, category,
        event_key, due_at, status, subject, payload
      ) values (
        v_recipient.id, lower(trim(v_recipient.email)),
        encode(extensions.digest(lower(trim(v_recipient.email)), 'sha256'), 'hex'),
        'admin_message', 'operational',
        'finance-report:' || v_schedule.id::text || ':' || extract(epoch from v_schedule.next_run_at)::bigint || ':' || v_recipient.id::text,
        now(), 'queued', v_schedule.subject,
        jsonb_build_object(
          'subject', v_schedule.subject,
          'body', v_body,
          'recipientName', v_recipient.full_name,
          'groupLabel', 'Scheduled Finance Management Report',
          'senderId', v_actor,
          'senderName', 'AgileCert Finance Governance',
          'reportType', v_schedule.report_type,
          'scheduleId', v_schedule.id,
          'periodStart', v_period_start,
          'periodEnd', v_period_end
        )
      ) on conflict do nothing returning id into v_outbox_id;

      if v_outbox_id is not null then
        insert into public.agilecert_communication_events(outbox_id, candidate_id, event_type, metadata)
        values (v_outbox_id, v_recipient.id, 'queued', jsonb_build_object('source', 'finance_scheduled_report'));
        v_queued_count := v_queued_count + 1;
        v_queued := v_queued + 1;
      end if;
    end loop;

    v_run_status := case
      when v_recipient_count = 0 then 'failed'
      when v_queued_count = v_recipient_count then 'queued'
      when v_queued_count > 0 then 'partial'
      else 'skipped'
    end;

    insert into public.agilecert_finance_report_runs(
      schedule_id, scheduled_for, period_start, period_end, status,
      recipient_count, queued_count, error_message, summary
    ) values (
      v_schedule.id, v_schedule.next_run_at, v_period_start, v_period_end,
      v_run_status, v_recipient_count, v_queued_count,
      case when v_recipient_count = 0 then 'No active staff recipient was available.' else null end,
      jsonb_build_object('examOrders', v_exam_orders, 'bulkOrders', v_bulk_orders,
        'failedPayments', v_failed_payments, 'openCases', v_open_cases,
        'openAlerts', v_open_alerts, 'revenueMinorByCurrency', v_revenue_text)
    ) on conflict (schedule_id, scheduled_for) do nothing;

    update public.agilecert_finance_report_schedules
    set last_run_at = v_schedule.next_run_at,
        next_run_at = public.finance_next_report_run(
          v_schedule.cadence, v_schedule.day_of_week, v_schedule.day_of_month,
          v_schedule.run_time, v_schedule.timezone, v_schedule.next_run_at + interval '1 second'
        )
    where id = v_schedule.id;

    v_processed := v_processed + 1;
  end loop;

  insert into public.audit_logs(actor_id, action, entity_type, metadata)
  values (v_actor, 'process_due_finance_reports', 'finance_report_run',
    jsonb_build_object('processedSchedules', v_processed, 'emailsQueued', v_queued));

  return jsonb_build_object('processedSchedules', v_processed, 'emailsQueued', v_queued);
end;
$$;

create or replace function public.get_finance_governance_snapshot(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 250), 1000));
  v_access jsonb;
begin
  if not public.agilecert_has_finance_permission('finance.governance.view') then
    raise exception 'This account does not have permission to view finance governance.';
  end if;
  v_access := public.get_my_finance_console_access();

  return jsonb_build_object(
    'generatedAt', now(),
    'access', jsonb_build_object(
      'actorId', v_access->>'actorId',
      'role', v_access->>'role',
      'permissions', coalesce(v_access->'permissions', '[]'::jsonb),
      'canViewGovernance', coalesce((v_access->>'canViewGovernance')::boolean, false),
      'canSubmitCases', coalesce((v_access->>'canSubmitCases')::boolean, false),
      'canReviewCases', coalesce((v_access->>'canReviewCases')::boolean, false),
      'canManageAlerts', coalesce((v_access->>'canManageAlerts')::boolean, false),
      'canScheduleReports', coalesce((v_access->>'canScheduleReports')::boolean, false)
    ),
    'summary', jsonb_build_object(
      'openCases', (select count(*) from public.agilecert_finance_operation_cases where status in ('submitted','in_review','approved')),
      'pendingApprovals', (select count(*) from public.agilecert_finance_operation_cases where status in ('submitted','in_review')),
      'overdueCases', (select count(*) from public.agilecert_finance_operation_cases where status in ('submitted','in_review','approved') and due_at < now()),
      'openAlerts', (select count(*) from public.agilecert_finance_alerts where status in ('open','acknowledged')),
      'criticalAlerts', (select count(*) from public.agilecert_finance_alerts where status in ('open','acknowledged') and severity = 'critical'),
      'activeSchedules', (select count(*) from public.agilecert_finance_report_schedules where is_active)
    ),
    'staffRecipients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id, 'fullName', profile.full_name, 'email', profile.email, 'role', profile.role
      ) order by profile.role, profile.full_name)
      from public.profiles profile
      where profile.is_active and profile.role in ('auditor','exam_admin','super_admin')
    ), '[]'::jsonb),
    'cases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', case_row.id, 'caseNumber', case_row.case_number,
        'caseType', case_row.case_type, 'orderType', case_row.order_type,
        'orderId', case_row.order_id, 'reference', case_row.reference,
        'candidateId', case_row.candidate_id, 'currency', case_row.currency,
        'amountMinor', case_row.amount_minor, 'title', case_row.title,
        'description', case_row.description, 'priority', case_row.priority,
        'status', case_row.status, 'requiredApprovals', case_row.required_approvals,
        'approvalCount', (select count(*) from public.agilecert_finance_operation_case_events event_row where event_row.case_id = case_row.id and event_row.event_type = 'approved'),
        'requestedBy', case_row.requested_by, 'requesterName', requester.full_name,
        'assignedTo', case_row.assigned_to, 'assignedName', assignee.full_name,
        'submittedAt', case_row.submitted_at, 'dueAt', case_row.due_at,
        'resolvedAt', case_row.resolved_at, 'outcome', case_row.outcome,
        'metadata', case_row.metadata, 'createdAt', case_row.created_at,
        'updatedAt', case_row.updated_at,
        'events', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', event_row.id, 'eventType', event_row.event_type,
            'actorId', event_row.actor_id, 'actorName', actor.full_name,
            'fromStatus', event_row.from_status, 'toStatus', event_row.to_status,
            'note', event_row.note, 'metadata', event_row.metadata,
            'createdAt', event_row.created_at
          ) order by event_row.created_at)
          from public.agilecert_finance_operation_case_events event_row
          left join public.profiles actor on actor.id = event_row.actor_id
          where event_row.case_id = case_row.id
        ), '[]'::jsonb)
      ) order by case_row.created_at desc)
      from (
        select * from public.agilecert_finance_operation_cases
        order by created_at desc limit v_limit
      ) case_row
      left join public.profiles requester on requester.id = case_row.requested_by
      left join public.profiles assignee on assignee.id = case_row.assigned_to
    ), '[]'::jsonb),
    'alertRules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rule.id, 'ruleCode', rule.rule_code, 'name', rule.name,
        'description', rule.description, 'severity', rule.severity,
        'thresholdHours', rule.threshold_hours, 'thresholdCount', rule.threshold_count,
        'recipientIds', rule.recipient_ids, 'emailEnabled', rule.email_enabled,
        'isActive', rule.is_active, 'updatedAt', rule.updated_at
      ) order by rule.name)
      from public.agilecert_finance_alert_rules rule
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', alert_row.id, 'ruleId', alert_row.rule_id,
        'ruleCode', rule.rule_code, 'entityType', alert_row.entity_type,
        'entityId', alert_row.entity_id, 'reference', alert_row.reference,
        'title', alert_row.title, 'message', alert_row.message,
        'severity', alert_row.severity, 'status', alert_row.status,
        'firstSeenAt', alert_row.first_seen_at, 'lastSeenAt', alert_row.last_seen_at,
        'acknowledgedBy', alert_row.acknowledged_by,
        'acknowledgedAt', alert_row.acknowledged_at,
        'resolvedBy', alert_row.resolved_by, 'resolvedAt', alert_row.resolved_at,
        'resolutionNote', alert_row.resolution_note,
        'lastNotifiedAt', alert_row.last_notified_at, 'metadata', alert_row.metadata
      ) order by
        case alert_row.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
        alert_row.last_seen_at desc)
      from (
        select * from public.agilecert_finance_alerts
        order by last_seen_at desc limit v_limit
      ) alert_row
      join public.agilecert_finance_alert_rules rule on rule.id = alert_row.rule_id
    ), '[]'::jsonb),
    'reportSchedules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', schedule.id, 'name', schedule.name, 'reportType', schedule.report_type,
        'cadence', schedule.cadence, 'dayOfWeek', schedule.day_of_week,
        'dayOfMonth', schedule.day_of_month, 'runTime', schedule.run_time,
        'timezone', schedule.timezone, 'recipientIds', schedule.recipient_ids,
        'subject', schedule.subject, 'isActive', schedule.is_active,
        'nextRunAt', schedule.next_run_at, 'lastRunAt', schedule.last_run_at,
        'createdBy', schedule.created_by, 'updatedAt', schedule.updated_at
      ) order by schedule.is_active desc, schedule.next_run_at)
      from public.agilecert_finance_report_schedules schedule
    ), '[]'::jsonb),
    'reportRuns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', run.id, 'scheduleId', run.schedule_id,
        'scheduleName', schedule.name, 'scheduledFor', run.scheduled_for,
        'periodStart', run.period_start, 'periodEnd', run.period_end,
        'status', run.status, 'recipientCount', run.recipient_count,
        'queuedCount', run.queued_count, 'errorMessage', run.error_message,
        'summary', run.summary, 'createdAt', run.created_at
      ) order by run.created_at desc)
      from (
        select * from public.agilecert_finance_report_runs
        order by created_at desc limit v_limit
      ) run
      join public.agilecert_finance_report_schedules schedule on schedule.id = run.schedule_id
    ), '[]'::jsonb)
  );
end;
$$;

alter table public.agilecert_finance_operation_cases enable row level security;
alter table public.agilecert_finance_operation_case_events enable row level security;
alter table public.agilecert_finance_alert_rules enable row level security;
alter table public.agilecert_finance_alerts enable row level security;
alter table public.agilecert_finance_report_schedules enable row level security;
alter table public.agilecert_finance_report_runs enable row level security;

revoke all on table public.agilecert_finance_operation_cases from public, anon, authenticated;
revoke all on table public.agilecert_finance_operation_case_events from public, anon, authenticated;
revoke all on table public.agilecert_finance_alert_rules from public, anon, authenticated;
revoke all on table public.agilecert_finance_alerts from public, anon, authenticated;
revoke all on table public.agilecert_finance_report_schedules from public, anon, authenticated;
revoke all on table public.agilecert_finance_report_runs from public, anon, authenticated;

revoke all on function public.agilecert_block_finance_case_event_mutation() from public, anon, authenticated;
revoke all on function public.finance_next_report_run(text,integer,integer,time,text,timestamptz) from public, anon, authenticated;
revoke all on function public.finance_create_operation_case(text,text,text,text,text,uuid,text,uuid,text,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.finance_add_operation_case_note(uuid,text) from public, anon, authenticated;
revoke all on function public.finance_assign_operation_case(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.finance_decide_operation_case(uuid,text,text) from public, anon, authenticated;
revoke all on function public.finance_execute_operation_case(uuid,jsonb,text) from public, anon, authenticated;
revoke all on function public.finance_cancel_operation_case(uuid,text) from public, anon, authenticated;
revoke all on function public.finance_update_alert_rule(text,text,integer,integer,uuid[],boolean,boolean,text) from public, anon, authenticated;
revoke all on function public.finance_scan_governance_alerts() from public, anon, authenticated;
revoke all on function public.finance_update_alert_status(uuid,text,text) from public, anon, authenticated;
revoke all on function public.finance_upsert_report_schedule(uuid,text,text,text,integer,integer,time,text,uuid[],text,boolean,text) from public, anon, authenticated;
revoke all on function public.finance_process_due_report_schedules(integer) from public, anon, authenticated;
revoke all on function public.get_finance_governance_snapshot(integer) from public, anon, authenticated;

-- Internal scheduling helper remains inaccessible to browser sessions.
grant execute on function public.finance_create_operation_case(text,text,text,text,text,uuid,text,uuid,text,bigint,jsonb) to authenticated;
grant execute on function public.finance_add_operation_case_note(uuid,text) to authenticated;
grant execute on function public.finance_assign_operation_case(uuid,uuid,text) to authenticated;
grant execute on function public.finance_decide_operation_case(uuid,text,text) to authenticated;
grant execute on function public.finance_execute_operation_case(uuid,jsonb,text) to authenticated;
grant execute on function public.finance_cancel_operation_case(uuid,text) to authenticated;
grant execute on function public.finance_update_alert_rule(text,text,integer,integer,uuid[],boolean,boolean,text) to authenticated;
grant execute on function public.finance_scan_governance_alerts() to authenticated;
grant execute on function public.finance_update_alert_status(uuid,text,text) to authenticated;
grant execute on function public.finance_upsert_report_schedule(uuid,text,text,text,integer,integer,time,text,uuid[],text,boolean,text) to authenticated;
grant execute on function public.finance_process_due_report_schedules(integer) to authenticated;
grant execute on function public.get_finance_governance_snapshot(integer) to authenticated;

comment on table public.agilecert_finance_operation_cases is
  'Maker-checker finance operations cases. Approval records and notes are retained in the immutable event table.';
comment on table public.agilecert_finance_alerts is
  'Operational finance alerts generated from server-authoritative finance and governance records.';
comment on table public.agilecert_finance_report_schedules is
  'Management-report schedules whose due summaries are queued through the controlled AgileCert communications outbox.';
comment on function public.finance_execute_operation_case(uuid,jsonb,text) is
  'Records execution evidence for an approved case. It does not directly mutate payment, order, fulfilment or certificate records.';

commit;
