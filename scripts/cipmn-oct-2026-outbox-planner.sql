-- CIPMN October 2026 branch-only outbox planner.
-- READ ONLY. Produces prioritized candidate communications without inserting rows.

with params as (
  select now() as as_of
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
 -- Official MOD-012 is internally mapped to the live international-programmes exam id.
 ('MOD-012',date '2026-10-15','3327bd65-d739-9b41-78f5-1c54da529c35'::uuid),
 ('EL01',date '2026-10-16','9eb84cf2-bd25-f4ed-084b-413d7a976237'::uuid),
 ('EL02',date '2026-10-17','98eedf01-59f6-979f-b2b9-2f55a640e6d0'::uuid),
 ('EL03',date '2026-10-17','76f9ca55-0ecb-ac3b-a823-7e350b857e84'::uuid),
 ('EL04',date '2026-10-17','00dbbdb2-03a4-52d6-6ff6-6310520d23b2'::uuid),
 ('EL05',date '2026-10-18','5e3969ef-fbd3-84e9-e853-2f27ed0ce264'::uuid)
),
base as (
 select cl.*, p.id candidate_id, o.*,
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
     when b.exam_date < ((select as_of from params) at time zone 'Africa/Lagos')::date then 'examination_passed'
     when b.candidate_id is null then 'unregistered'
     when not b.purchased then 'unpurchased'
     when b.completed then 'completed'
     when b.started then 'in_progress'
     else 'never_started'
   end state
 from base b
),
summary as (
 select full_name,email,phone,candidate_id,
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
   eo.id order_id
 from public.exam_orders eo
 join official off on off.examination_id=eo.examination_id
 where eo.status in ('pending','cancelled','expired','failed')
   and off.exam_date >= ((select as_of from params) at time zone 'Africa/Lagos')::date
   and not exists (
     select 1 from public.exam_orders paid
     where paid.candidate_id=eo.candidate_id
       and paid.examination_id=eo.examination_id
       and paid.status in ('paid','waived')
   )
 order by eo.candidate_id,eo.examination_id,eo.updated_at desc
),
recovery_summary as (
 select candidate_id,
   string_agg(module_code,', ' order by exam_date,module_code) recovery_modules,
   min(exam_date) nearest_recovery_date,
   min(reference) reference
 from recovery
 group by candidate_id
),
candidate_plan as (
 select s.*, r.recovery_modules,r.nearest_recovery_date,r.reference,
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
     when s.unpurchased_modules is not null and s.remaining_modules is not null then 'cipmn_exam_preparation'
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
)
select
  full_name,
  email,
  phone,
  candidate_id,
  candidate_id is not null as eligible_for_existing_outbox,
  send_slot,
  message_type,
  case message_type
    when 'cipmn_payment_recovery' then recovery_modules
    when 'cipmn_mock_resume' then in_progress_modules
    when 'cipmn_mock_start' then never_started_modules
    when 'cipmn_unpurchased_modules' then unpurchased_modules
    when 'cipmn_exam_preparation' then remaining_modules
    else null
  end as module_codes,
  case message_type
    when 'cipmn_payment_recovery' then nearest_recovery_date
    when 'cipmn_mock_resume' then nearest_resume_date
    when 'cipmn_mock_start' then nearest_start_date
    when 'cipmn_unpurchased_modules' then nearest_unpurchased_date
    when 'cipmn_exam_preparation' then nearest_remaining_date
    else null
  end as nearest_examination_date,
  reference,
  completed_count,
  'iipmnigeria@gmail.com'::text monitor_copy_email,
  case
    when candidate_id is null then 'registration outreach requires safe email-only onboarding path'
    else 'existing AgileCert outbox eligible after activation'
  end as delivery_note
from slots
order by full_name,send_slot;
