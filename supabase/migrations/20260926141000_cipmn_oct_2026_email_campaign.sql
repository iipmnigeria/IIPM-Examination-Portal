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
  queue_horizon_minutes integer not null default 90 check (queue_horizon_minutes between 30 and 180),
  discount_code text null default 'CIPMN26-ACCESS88',
  discount_expires_on date null default date '2026-09-30',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cipmn_oct_2026_email_campaign enable row level security;
revoke all on table public.cipmn_oct_2026_email_campaign from anon, authenticated;
grant select, insert, update, delete on table public.cipmn_oct_2026_email_campaign to service_role;

insert into public.cipmn_oct_2026_email_campaign(
  singleton, enabled, monitor_copy_email, campaign_start_date, campaign_end_date,
  max_daily_emails, minimum_gap_hours, queue_horizon_minutes, discount_code, discount_expires_on
)
values (
  true, false, 'iipmnigeria@gmail.com', date '2026-09-26', date '2026-10-18',
  2, 6, 90, 'CIPMN26-ACCESS88', date '2026-09-30'
)
on conflict (singleton) do update
set enabled = false,
    monitor_copy_email = excluded.monitor_copy_email,
    campaign_start_date = excluded.campaign_start_date,
    campaign_end_date = excluded.campaign_end_date,
    max_daily_emails = excluded.max_daily_emails,
    minimum_gap_hours = excluded.minimum_gap_hours,
    queue_horizon_minutes = excluded.queue_horizon_minutes,
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
security invoker
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
 -- Official MOD-012 maps internally to the live international-programmes record.
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
     select 1 from public.exam_orders x
     where x.candidate_id=p.id
       and x.examination_id=o.examination_id
       and x.status in ('paid','waived')
   ) purchased,
   exists(
     select 1 from public.attempts a
     where a.candidate_id=p.id
       and a.examination_id=o.examination_id
       and (a.submitted_at is not null or a.status in ('submitted','graded','completed'))
   ) completed,
   exists(
     select 1 from public.exam_sessions s
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
   eo.reference,
   greatest(eo.updated_at,coalesce(ep.updated_at,eo.updated_at)) unresolved_since
 from public.exam_orders eo
 join official off on off.examination_id=eo.examination_id
 left join lateral (
   select payment.status,payment.provider_payload,payment.updated_at
   from public.exam_payments payment
   where payment.order_id=eo.id
   order by payment.updated_at desc
   limit 1
 ) ep on true
 where (
     lower(eo.status) in ('pending','cancelled','expired','failed','abandoned','reversed','voided')
     or lower(coalesce(ep.status,'')) in ('failed','abandoned','reversed','voided','cancelled')
     or lower(coalesce(ep.provider_payload->>'status','')) in ('failed','abandoned','reversed','voided','cancelled')
   )
   and off.exam_date >= (p_now at time zone 'Africa/Lagos')::date
   and not exists (
     select 1
     from public.exam_orders paid
     where paid.candidate_id=eo.candidate_id
       and paid.examination_id=eo.examination_id
       and paid.status in ('paid','waived')
   )
 order by eo.candidate_id,eo.examination_id,greatest(eo.updated_at,coalesce(ep.updated_at,eo.updated_at)) desc
),
recovery_summary as (
 select
   candidate_id,
   string_agg(module_code,', ' order by exam_date,module_code) recovery_modules,
   min(exam_date) nearest_recovery_date,
   min(reference) reference,
   min(unresolved_since) unresolved_since
 from recovery
 group by candidate_id
),
last_type as (
 select
   box.candidate_id,
   box.message_type,
   max(coalesce(box.sent_at,box.claimed_at,box.due_at,box.created_at)) last_at
 from public.agilecert_communication_outbox box
 where box.event_key like 'cipmn-oct-2026:%'
   and box.status in ('processing','sent','delivered')
 group by box.candidate_id,box.message_type
),
last_any as (
 select
   box.candidate_id,
   max(coalesce(box.sent_at,box.claimed_at,box.due_at,box.created_at)) last_at,
   count(*) filter(
     where (coalesce(box.sent_at,box.claimed_at,box.due_at,box.created_at) at time zone 'Africa/Lagos')::date
           = (p_now at time zone 'Africa/Lagos')::date
   )::integer daily_count
 from public.agilecert_communication_outbox box
 where box.event_key like 'cipmn-oct-2026:%'
   and box.status in ('processing','sent','delivered')
 group by box.candidate_id
),
streams as (
 select s.*, r.recovery_modules,r.nearest_recovery_date,r.reference,r.unresolved_since,
        'cipmn_registration_outreach'::text message_type,0 priority,
        'marketing'::text category,
        null::text module_codes,null::date nearest_exam_date,null::timestamptz first_eligible_at,
        interval '3 days' cadence
 from summary s left join recovery_summary r on r.candidate_id=s.candidate_id
 where s.candidate_id is null

 union all
 select s.*, r.recovery_modules,r.nearest_recovery_date,r.reference,r.unresolved_since,
        'cipmn_payment_recovery',1,'operational',
        r.recovery_modules,r.nearest_recovery_date,r.unresolved_since + interval '1 hour',
        case when r.nearest_recovery_date - (p_now at time zone 'Africa/Lagos')::date <= 3
             then interval '1 day' else interval '2 days' end
 from summary s join recovery_summary r on r.candidate_id=s.candidate_id
 where s.candidate_id is not null

 union all
 select s.*, r.recovery_modules,r.nearest_recovery_date,r.reference,r.unresolved_since,
        'cipmn_mock_resume',2,'operational',
        s.in_progress_modules,s.nearest_resume_date,null::timestamptz,interval '1 day'
 from summary s left join recovery_summary r on r.candidate_id=s.candidate_id
 where s.candidate_id is not null and s.in_progress_modules is not null

 union all
 select s.*, r.recovery_modules,r.nearest_recovery_date,r.reference,r.unresolved_since,
        'cipmn_mock_start',3,'operational',
        s.never_started_modules,s.nearest_start_date,null::timestamptz,
        case when s.nearest_start_date - (p_now at time zone 'Africa/Lagos')::date <= 3
             then interval '1 day' else interval '2 days' end
 from summary s left join recovery_summary r on r.candidate_id=s.candidate_id
 where s.candidate_id is not null and s.never_started_modules is not null

 union all
 select s.*, r.recovery_modules,r.nearest_recovery_date,r.reference,r.unresolved_since,
        'cipmn_unpurchased_modules',4,'marketing',
        s.unpurchased_modules,s.nearest_unpurchased_date,null::timestamptz,
        case when s.nearest_unpurchased_date - (p_now at time zone 'Africa/Lagos')::date <= 3
             then interval '1 day' else interval '3 days' end
 from summary s left join recovery_summary r on r.candidate_id=s.candidate_id
 where s.candidate_id is not null and s.unpurchased_modules is not null

 union all
 select s.*, r.recovery_modules,r.nearest_recovery_date,r.reference,r.unresolved_since,
        'cipmn_exam_preparation',5,'marketing',
        s.remaining_modules,s.nearest_remaining_date,null::timestamptz,
        case when (p_now at time zone 'Africa/Lagos')::date < date '2026-10-06'
             then interval '3 days' else interval '1 day' end
 from summary s left join recovery_summary r on r.candidate_id=s.candidate_id
 where s.candidate_id is not null and s.remaining_modules is not null
),
stream_status as (
 select
   st.*,
   lt.last_at as last_type_at,
   la.last_at as last_any_at,
   coalesce(la.daily_count,0) daily_count,
   exists(
     select 1
     from public.agilecert_communication_outbox open_box
     where open_box.candidate_id=st.candidate_id
       and open_box.message_type=st.message_type
       and open_box.event_key like 'cipmn-oct-2026:%'
       and open_box.status in ('queued','processing','failed')
   ) as open_message_exists
 from streams st
 left join last_type lt
   on lt.candidate_id=st.candidate_id and lt.message_type=st.message_type
 left join last_any la on la.candidate_id=st.candidate_id
),
due_streams as (
 select ss.*
 from stream_status ss
 cross join campaign c
 where
   (
     ss.candidate_id is null
     or (
       not ss.open_message_exists
       and coalesce(ss.daily_count,0) < c.max_daily_emails
       and (ss.first_eligible_at is null or p_now >= ss.first_eligible_at)
       and (ss.last_type_at is null or ss.last_type_at <= p_now - ss.cadence)
     )
   )
),
nonredundant as (
 select ds.*
 from due_streams ds
 where ds.message_type <> 'cipmn_exam_preparation'
    or not exists (
      select 1 from due_streams higher
      where higher.candidate_id=ds.candidate_id
        and higher.priority < ds.priority
    )
),
ranked as (
 select nr.*,
        row_number() over(partition by coalesce(nr.candidate_id::text,nr.email) order by nr.priority) rn
 from nonredundant nr
),
next_window as (
 select
   r.*,
   c.monitor_copy_email,c.minimum_gap_hours,c.queue_horizon_minutes,
   case
     when (p_now at time zone 'Africa/Lagos')::time < time '08:30'
       then ((p_now at time zone 'Africa/Lagos')::date + time '08:30') at time zone 'Africa/Lagos'
     when (p_now at time zone 'Africa/Lagos')::time < time '14:30'
       then ((p_now at time zone 'Africa/Lagos')::date + time '14:30') at time zone 'Africa/Lagos'
     else (((p_now at time zone 'Africa/Lagos')::date + 1) + time '08:30') at time zone 'Africa/Lagos'
   end proposed_due_at
 from ranked r cross join campaign c
 where r.rn=1
),
final as (
 select nw.*
 from next_window nw
 cross join campaign c
 where (p_now at time zone 'Africa/Lagos')::date between c.campaign_start_date and c.campaign_end_date
   and nw.proposed_due_at <= p_now + make_interval(mins => c.queue_horizon_minutes)
   and (
     nw.candidate_id is null
     or nw.last_any_at is null
     or nw.proposed_due_at >= nw.last_any_at + make_interval(hours => c.minimum_gap_hours)
   )
)
select
  f.candidate_id,
  f.full_name recipient_name,
  lower(f.email) recipient_email,
  f.phone,
  f.candidate_id is not null registered,
  coalesce(f.daily_count,0)+1 send_slot,
  f.message_type,
  f.category,
  f.module_codes,
  f.nearest_exam_date nearest_examination_date,
  f.reference payment_reference,
  f.completed_count,
  f.monitor_copy_email,
  f.proposed_due_at,
  case
    when f.candidate_id is null then
      'cipmn-oct-2026:registration:' || encode(extensions.digest(lower(f.email), 'sha256'), 'hex') ||
      ':' || to_char((f.proposed_due_at at time zone 'Africa/Lagos')::date,'YYYYMMDD')
    else
      'cipmn-oct-2026:' || f.message_type || ':' || f.candidate_id::text ||
      ':' || to_char((f.proposed_due_at at time zone 'Africa/Lagos')::date,'YYYYMMDD') ||
      ':' || substr(encode(extensions.digest(coalesce(f.module_codes,'') || '|' || coalesce(f.reference,''),'sha256'),'hex'),1,12)
  end event_key,
  case
    when f.candidate_id is null then 'registration outreach requires safe email-only onboarding path'
    else 'eligible for existing AgileCert outbox when campaign is enabled'
  end delivery_note
from final f
order by f.full_name
$function$;

create or replace function public.refresh_cipmn_oct_2026_email_outbox(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth, extensions
as $function$
declare
  v_enabled boolean := false;
  v_inserted integer := 0;
  v_monitor text;
  v_discount text;
  v_discount_expires date;
begin
  select enabled,monitor_copy_email,discount_code,discount_expires_on
  into v_enabled,v_monitor,v_discount,v_discount_expires
  from public.cipmn_oct_2026_email_campaign
  where singleton;

  if not coalesce(v_enabled,false) then
    return jsonb_build_object(
      'enabled',false,
      'inserted',0,
      'reason','cipmn_oct_2026_campaign_disabled',
      'refreshedAt',p_now
    );
  end if;

  insert into public.agilecert_communication_outbox(
    candidate_id,recipient_email,recipient_email_hash,message_type,category,
    event_key,due_at,payload
  )
  select
    p.candidate_id,
    p.recipient_email,
    encode(extensions.digest(lower(p.recipient_email),'sha256'),'hex'),
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
      'discountCode',case
        when v_discount_expires is null
          or (p_now at time zone 'Africa/Lagos')::date <= v_discount_expires
        then v_discount else null end,
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
    'enabled',true,
    'inserted',v_inserted,
    'monitorCopyEmail',v_monitor,
    'refreshedAt',p_now
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
'Queues at most one currently due prioritized CIPMN message per candidate within a 90-minute send horizon, only when the campaign enabled flag is true.';
