-- CIPMN October 2026 examination email automation.
-- SAFETY: campaign is installed disabled. No CIPMN campaign row can be queued
-- unless public.cipmn_oct_2026_email_campaign.enabled is explicitly set true
-- in a separate reviewed activation step.

create table if not exists public.cipmn_oct_2026_email_campaign (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  monitor_copy_email text not null default 'iipmnigeria@gmail.com',
  campaign_start_date date not null default date '2026-09-26',
  campaign_end_date date not null default date '2026-10-18',
  max_daily_emails integer not null default 2 check (max_daily_emails between 1 and 2),
  minimum_gap_hours integer not null default 6 check (minimum_gap_hours >= 6),
  discount_code text null default 'CIPMN26-ACCESS88',
  discount_expires_on date null default date '2026-09-30',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.cipmn_oct_2026_email_campaign(
  singleton, enabled, monitor_copy_email, campaign_start_date, campaign_end_date,
  max_daily_emails, minimum_gap_hours, discount_code, discount_expires_on
)
values (
  true, false, 'iipmnigeria@gmail.com', date '2026-09-26', date '2026-10-18',
  2, 6, 'CIPMN26-ACCESS88', date '2026-09-30'
)
on conflict (singleton) do update
set enabled = false,
    monitor_copy_email = excluded.monitor_copy_email,
    campaign_start_date = excluded.campaign_start_date,
    campaign_end_date = excluded.campaign_end_date,
    max_daily_emails = excluded.max_daily_emails,
    minimum_gap_hours = excluded.minimum_gap_hours,
    discount_code = excluded.discount_code,
    discount_expires_on = excluded.discount_expires_on,
    updated_at = now();

alter table public.agilecert_communication_settings
  add column if not exists monitor_copy_email text;

update public.agilecert_communication_settings
set monitor_copy_email = 'iipmnigeria@gmail.com',
    updated_at = now()
where singleton = true
  and coalesce(monitor_copy_email, '') = '';

create or replace function public.preview_cipmn_oct_2026_email_campaign(
  p_now timestamptz default now()
)
returns table (
  candidate_id uuid,
  recipient_name text,
  recipient_email text,
  phone text,
  registered boolean,
  send_slot integer,
  message_type text,
  category text,
  module_codes text,
  nearest_examination_date date,
  payment_reference text,
  completed_count bigint,
  monitor_copy_email text,
  proposed_due_at timestamptz,
  event_key text,
  delivery_note text
)
language sql
security definer
set search_path = public, auth, extensions
as $function$
with
campaign as (
  select *
  from public.cipmn_oct_2026_email_campaign
  where singleton
),
candidate_list(full_name,email,phone) as (
 values
 ('Bello Alhaji Abubakar','belloncy007@gmail.com','08066043564'),
 ('Iwajomo Adeboye','iwajomoa@gmail.com','08169598389'),
 ('Umaina Ibrahim Muhammad','umainaibrahim@gmail.com','08052624522'),
 ('Chiemerie Nnenna Awuzie','chiemerieejiogu@gmail.com','08031526099'),
 ('Emmanuel Habu Ikrenwo','habuikrenwo@gmail.com','08050528390'),
 ('Fatima Adamu Muhammed','adamuphateema@gmail.com','08139136568'),
 ('Ofoegbu Lotanna Steven','lotanna@gmail.com','08053635669'),
 ('Hafsat Funmilayo Bankole','hafsatfunmilayo2015@gmail.com','07035995662'),
 ('Benjamin Edache Ikwulono','boldbenedoh104@gmail.com','09130822248'),
 ('Ohilebo David Moshope','shopeohilebo@gmail.com','08108701111'),
 ('Mary Ekikereobong Matthew','maryimoh.b@gmail.com','08036550473'),
 ('Izedonmen Friday Egbokhare','izedonmenfriday@gmail.com','08066104739')
),
official(module_code,exam_date,examination_id) as (
 values
 ('MOD-001',date '2026-10-08','2e5fea8b-a4de-5c61-9a43-e53e9d28403f'::uuid),
 ('MOD-002',date '2026-10-09','fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'::uuid),
 ('MOD-003',date '2026-10-10','916ed55c-e157-5e23-9d46-43ad4e2b9c2a'::uuid),
 ('MOD-004',date '2026-10-10','5322572d-27b0-5467-ab89-c6b45612b960'::uuid),
 ('MOD-005',date '2026-10-10','d0c77c9c-a711-5864-97ac-c930ca231773'::uuid),
 ('MOD-006',date '2026-10-11','63311ad6-4bc2-59b6-a5fd-283423c4a2ac'::uuid),
 ('MOD-007',date '2026-10-11','a573f28c-a38a-5978-a6a9-42b1d8239935'::uuid),
 ('MOD-008',date '2026-10-11','2eec289b-9c0b-57e4-a2c6-e288fa6d4a28'::uuid),
 ('MOD-009',date '2026-10-12','8305ebe1-ea1e-5089-bf4c-cb5bac29a918'::uuid),
 ('MOD-010',date '2026-10-13','37eaf7f3-42c8-525c-8c28-cd9c3327da13'::uuid),
 ('MOD-011',date '2026-10-14','6561efd6-938e-5da0-aae3-520349741cc9'::uuid),
 -- Official MOD-012 maps internally to the current international-programmes record.
 ('MOD-012',date '2026-10-15','3327bd65-d739-9b41-78f5-1c54da529c35'::uuid),
 ('EL01',date '2026-10-16','9eb84cf2-bd25-f4ed-084b-413d7a976237'::uuid),
 ('EL02',date '2026-10-17','98eedf01-59f6-979f-b2b9-2f55a640e6d0'::uuid),
 ('EL03',date '2026-10-17','76f9ca55-0ecb-ac3b-a823-7e350b857e84'::uuid),
 ('EL04',date '2026-10-17','00dbbdb2-03a4-52d6-6ff6-6310520d23b2'::uuid),
 ('EL05',date '2026-10-18','5e3969ef-fbd3-84e9-e853-2f27ed0ce264'::uuid)
),
base as (
 select
   cl.full_name,
   cl.email,
   cl.phone,
   p.id candidate_id,
   o.module_code,
   o.exam_date,
   o.examination_id,
   exists(
     select 1
     from public.exam_orders x
     where x.candidate_id=p.id
       and x.examination_id=o.examination_id
       and x.status in ('paid','waived')
   ) purchased,
   exists(
     select 1
     from public.attempts a
     where a.candidate_id=p.id
       and a.examination_id=o.examination_id
       and (a.submitted_at is not null or a.status in ('submitted','graded','completed'))
   ) completed,
   exists(
     select 1
     from public.exam_sessions s
     where s.candidate_id=p.id
       and s.examination_id=o.examination_id
       and s.started_at is not null
   ) started
 from candidate_list cl
 left join public.profiles p on lower(p.email)=cl.email
 cross join official o
),
state as (
 select b.*,
   case
     when b.exam_date < (p_now at time zone 'Africa/Lagos')::date then 'examination_passed'
     when b.candidate_id is null then 'unregistered'
     when not b.purchased then 'unpurchased'
     when b.completed then 'completed'
     when b.started then 'in_progress'
     else 'never_started'
   end state
 from base b
),
summary as (
 select
   full_name,email,phone,candidate_id,
   count(*) filter(where state='completed') completed_count,
   string_agg(module_code,', ' order by exam_date,module_code) filter(where state='never_started') never_started_modules,
   min(exam_date) filter(where state='never_started') nearest_start_date,
   string_agg(module_code,', ' order by exam_date,module_code) filter(where state='in_progress') in_progress_modules,
   min(exam_date) filter(where state='in_progress') nearest_resume_date,
   string_agg(module_code,', ' order by exam_date,module_code) filter(where state='unpurchased') unpurchased_modules,
   min(exam_date) filter(where state='unpurchased') nearest_unpurchased_date,
   string_agg(module_code,', ' order by exam_date,module_code)
     filter(where state not in ('completed','examination_passed','unregistered')) remaining_modules,
   min(exam_date)
     filter(where state not in ('completed','examination_passed','unregistered')) nearest_remaining_date
 from state
 group by full_name,email,phone,candidate_id
),
recovery as (
 select distinct on (eo.candidate_id,eo.examination_id)
   eo.candidate_id,
   off.module_code,
   off.exam_date,
   eo.reference
 from public.exam_orders eo
 join official off on off.examination_id=eo.examination_id
 where eo.status in ('pending','cancelled','expired','failed')
   and off.exam_date >= (p_now at time zone 'Africa/Lagos')::date
   and not exists (
     select 1
     from public.exam_orders paid
     where paid.candidate_id=eo.candidate_id
       and paid.examination_id=eo.examination_id
       and paid.status in ('paid','waived')
   )
 order by eo.candidate_id,eo.examination_id,eo.updated_at desc
),
recovery_summary as (
 select
   candidate_id,
   string_agg(module_code,', ' order by exam_date,module_code) recovery_modules,
   min(exam_date) nearest_recovery_date,
   min(reference) reference
 from recovery
 group by candidate_id
),
candidate_plan as (
 select
   s.*,
   r.recovery_modules,r.nearest_recovery_date,r.reference,
   case
     when s.candidate_id is null then 'cipmn_registration_outreach'
     when r.recovery_modules is not null then 'cipmn_payment_recovery'
     when s.in_progress_modules is not null then 'cipmn_mock_resume'
     when s.never_started_modules is not null then 'cipmn_mock_start'
     when s.unpurchased_modules is not null then 'cipmn_unpurchased_modules'
     when s.remaining_modules is not null then 'cipmn_exam_preparation'
     else null
   end primary_type,
   case
     when s.candidate_id is null then null
     when r.recovery_modules is not null and s.in_progress_modules is not null then 'cipmn_mock_resume'
     when r.recovery_modules is not null and s.never_started_modules is not null then 'cipmn_mock_start'
     when s.in_progress_modules is not null and s.unpurchased_modules is not null then 'cipmn_unpurchased_modules'
     when s.never_started_modules is not null and s.unpurchased_modules is not null then 'cipmn_unpurchased_modules'
     else null
   end secondary_type
 from summary s
 left join recovery_summary r on r.candidate_id=s.candidate_id
),
slots as (
 select cp.*,1 as send_slot,cp.primary_type as message_type
 from candidate_plan cp
 where cp.primary_type is not null
 union all
 select cp.*,2 as send_slot,cp.secondary_type as message_type
 from candidate_plan cp
 where cp.secondary_type is not null
),
planned as (
 select
   full_name,
   email,
   phone,
   candidate_id,
   candidate_id is not null registered,
   send_slot,
   message_type,
   case
     when message_type in ('cipmn_payment_recovery','cipmn_mock_resume','cipmn_mock_start')
       then 'operational'
     else 'marketing'
   end category,
   case message_type
     when 'cipmn_payment_recovery' then recovery_modules
     when 'cipmn_mock_resume' then in_progress_modules
     when 'cipmn_mock_start' then never_started_modules
     when 'cipmn_unpurchased_modules' then unpurchased_modules
     when 'cipmn_exam_preparation' then remaining_modules
     else null
   end module_codes,
   case message_type
     when 'cipmn_payment_recovery' then nearest_recovery_date
     when 'cipmn_mock_resume' then nearest_resume_date
     when 'cipmn_mock_start' then nearest_start_date
     when 'cipmn_unpurchased_modules' then nearest_unpurchased_date
     when 'cipmn_exam_preparation' then nearest_remaining_date
     else null
   end nearest_examination_date,
   reference,
   completed_count
 from slots
),
timed as (
 select
   pl.*,
   c.monitor_copy_email,
   case
     when ((p_now at time zone 'Africa/Lagos')::time < time '08:00')
       then ((p_now at time zone 'Africa/Lagos')::date + time '08:00') at time zone 'Africa/Lagos'
     else (((p_now at time zone 'Africa/Lagos')::date + 1) + time '08:00') at time zone 'Africa/Lagos'
   end
   + case when pl.send_slot=1 then interval '0 hour' else make_interval(hours => c.minimum_gap_hours) end
   as proposed_due_at
 from planned pl
 cross join campaign c
)
select
  t.candidate_id,
  t.full_name recipient_name,
  lower(t.email) recipient_email,
  t.phone,
  t.registered,
  t.send_slot,
  t.message_type,
  t.category,
  t.module_codes,
  t.nearest_examination_date,
  t.reference payment_reference,
  t.completed_count,
  t.monitor_copy_email,
  t.proposed_due_at,
  case
    when t.candidate_id is null then
      'cipmn-oct-2026:registration:' || encode(extensions.digest(lower(t.email), 'sha256'), 'hex') ||
      ':' || to_char((t.proposed_due_at at time zone 'Africa/Lagos')::date,'YYYYMMDD')
    else
      'cipmn-oct-2026:' || t.message_type || ':' || t.candidate_id::text ||
      ':' || to_char((t.proposed_due_at at time zone 'Africa/Lagos')::date,'YYYYMMDD') ||
      ':slot-' || t.send_slot::text
  end event_key,
  case
    when t.candidate_id is null then 'registration outreach requires safe email-only onboarding path'
    else 'eligible for existing AgileCert outbox when campaign is enabled'
  end delivery_note
from timed t
cross join campaign c
where (p_now at time zone 'Africa/Lagos')::date between c.campaign_start_date and c.campaign_end_date
order by t.full_name,t.send_slot
$function$;

create or replace function public.refresh_cipmn_oct_2026_email_outbox(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_enabled boolean := false;
  v_inserted integer := 0;
  v_cancelled integer := 0;
  v_monitor text;
  v_discount text;
  v_discount_expires date;
begin
  select enabled, monitor_copy_email, discount_code, discount_expires_on
  into v_enabled, v_monitor, v_discount, v_discount_expires
  from public.cipmn_oct_2026_email_campaign
  where singleton;

  if not coalesce(v_enabled,false) then
    return jsonb_build_object(
      'enabled', false,
      'inserted', 0,
      'cancelled', 0,
      'reason', 'cipmn_oct_2026_campaign_disabled',
      'refreshedAt', p_now
    );
  end if;

  -- Cancel queued/failed CIPMN rows whose underlying condition is no longer due
  -- or whose corresponding examination date has passed.
  update public.agilecert_communication_outbox box
  set status='cancelled',
      cancelled_at=p_now,
      updated_at=p_now,
      failure_code='cipmn_campaign_no_longer_due'
  where box.event_key like 'cipmn-oct-2026:%'
    and box.status in ('queued','failed')
    and not exists (
      select 1
      from public.preview_cipmn_oct_2026_email_campaign(p_now) p
      where p.candidate_id=box.candidate_id
        and p.message_type=box.message_type
        and p.registered
    );
  get diagnostics v_cancelled = row_count;

  insert into public.agilecert_communication_outbox(
    candidate_id,
    recipient_email,
    recipient_email_hash,
    message_type,
    category,
    event_key,
    due_at,
    payload
  )
  select
    p.candidate_id,
    p.recipient_email,
    encode(extensions.digest(lower(p.recipient_email), 'sha256'),'hex'),
    p.message_type,
    p.category,
    p.event_key,
    p.proposed_due_at,
    jsonb_build_object(
      'campaign','cipmn-oct-2026',
      'moduleCodes',p.module_codes,
      'moduleCode',p.module_codes,
      'nearestExaminationDate',p.nearest_examination_date,
      'nextExaminationDate',p.nearest_examination_date,
      'examinationDate',p.nearest_examination_date,
      'reference',p.payment_reference,
      'completedCount',p.completed_count,
      'monitorCopyEmail',v_monitor,
      'discountCode',case when v_discount_expires is null or
        (p_now at time zone 'Africa/Lagos')::date <= v_discount_expires then v_discount else null end,
      'discountExpiresAt',case when v_discount_expires is null then null else v_discount_expires::text end
    )
  from public.preview_cipmn_oct_2026_email_campaign(p_now) p
  join public.agilecert_communication_preferences pref
    on pref.candidate_id=p.candidate_id
  where p.registered
    and (
      p.category='operational' and pref.operational_messages
      or p.category='marketing' and pref.course_recommendations
    )
    and not exists (
      select 1
      from public.agilecert_communication_outbox recent
      where recent.candidate_id=p.candidate_id
        and recent.event_key like 'cipmn-oct-2026:%'
        and recent.status in ('queued','processing','sent','delivered')
        and (recent.due_at at time zone 'Africa/Lagos')::date =
            (p.proposed_due_at at time zone 'Africa/Lagos')::date
        and recent.due_at > p.proposed_due_at - interval '6 hours'
    )
  on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;

  insert into public.agilecert_communication_events(outbox_id,candidate_id,event_type,metadata)
  select box.id,box.candidate_id,'queued',
         jsonb_build_object('messageType',box.message_type,'campaign','cipmn-oct-2026')
  from public.agilecert_communication_outbox box
  where box.event_key like 'cipmn-oct-2026:%'
    and box.created_at >= p_now - interval '10 seconds'
    and not exists (
      select 1 from public.agilecert_communication_events e
      where e.outbox_id=box.id and e.event_type='queued'
    );

  return jsonb_build_object(
    'enabled', true,
    'inserted', v_inserted,
    'cancelled', v_cancelled,
    'monitorCopyEmail', v_monitor,
    'refreshedAt', p_now
  );
end;
$function$;

revoke all on function public.refresh_cipmn_oct_2026_email_outbox(timestamptz) from public;
revoke all on function public.preview_cipmn_oct_2026_email_campaign(timestamptz) from public;

grant execute on function public.refresh_cipmn_oct_2026_email_outbox(timestamptz) to service_role;
grant execute on function public.preview_cipmn_oct_2026_email_campaign(timestamptz) to service_role;

comment on table public.cipmn_oct_2026_email_campaign is
'Controlled campaign settings for the October 2026 CIPMN examination email automation. Seeded disabled.';

comment on function public.refresh_cipmn_oct_2026_email_outbox(timestamptz) is
'Queues CIPMN October 2026 campaign communications only when the central campaign enabled flag is true.';
