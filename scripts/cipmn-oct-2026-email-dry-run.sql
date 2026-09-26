-- CIPMN October 2026 email automation dry-run preview.
-- READ ONLY: this script must not INSERT/UPDATE/DELETE production data.
-- Official timetable supplied by IIPM/CIPMN is authoritative.

with candidate_list(full_name,email,phone) as (
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
 -- Official MOD-012 maps to the live EL06 record by authoritative subject/title.
 ('MOD-012',date '2026-10-15','3327bd65-d739-9b41-78f5-1c54da529c35'::uuid),
 ('EL01',date '2026-10-16','9eb84cf2-bd25-f4ed-084b-413d7a976237'::uuid),
 ('EL02',date '2026-10-17','98eedf01-59f6-979f-b2b9-2f55a640e6d0'::uuid),
 ('EL03',date '2026-10-17','76f9ca55-0ecb-ac3b-a823-7e350b857e84'::uuid),
 ('EL04',date '2026-10-17','00dbbdb2-03a4-52d6-6ff6-6310520d23b2'::uuid),
 ('EL05',date '2026-10-18','5e3969ef-fbd3-84e9-e853-2f27ed0ce264'::uuid)
),
candidate_module_state as (
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
resolved_state as (
 select *,
   case
     when exam_date < ((now() at time zone 'Africa/Lagos')::date) then 'examination_passed'
     when candidate_id is null then 'unregistered'
     when not purchased then 'unpurchased'
     when completed then 'completed'
     when started then 'in_progress'
     else 'never_started'
   end as state
 from candidate_module_state
),
recovery_orders as (
 select distinct on (eo.candidate_id,eo.examination_id)
   eo.id order_id,
   eo.reference,
   eo.candidate_id,
   eo.examination_id,
   eo.status order_status,
   coalesce(ep.status,'none') payment_status,
   lower(coalesce(ep.provider_payload->>'status','')) provider_status,
   eo.created_at,
   eo.updated_at
 from public.exam_orders eo
 left join lateral (
   select pmt.*
   from public.exam_payments pmt
   where pmt.order_id=eo.id
   order by pmt.updated_at desc
   limit 1
 ) ep on true
 where eo.status in ('pending','cancelled','expired','failed')
   and not exists (
     select 1 from public.exam_orders paid
     where paid.candidate_id=eo.candidate_id
       and paid.examination_id=eo.examination_id
       and paid.status in ('paid','waived')
   )
 order by eo.candidate_id,eo.examination_id,eo.updated_at desc
),
preview as (
 select
   s.full_name,
   s.email,
   s.phone,
   s.candidate_id,
   s.module_code,
   s.exam_date,
   s.examination_id,
   s.state,
   case
     when s.state='unregistered' then 'cipmn_registration_purchase'
     when s.state='unpurchased' then 'cipmn_unpurchased_module'
     when s.state='never_started' then 'cipmn_mock_start'
     when s.state='in_progress' then 'cipmn_mock_resume'
     else null
   end primary_stream,
   ro.order_id recovery_order_id,
   ro.reference recovery_reference,
   ro.order_status recovery_order_status,
   ro.payment_status recovery_payment_status,
   case
     when ro.order_id is not null and s.exam_date >= ((now() at time zone 'Africa/Lagos')::date)
       then true else false
   end payment_recovery_due,
   greatest(0, s.exam_date - ((now() at time zone 'Africa/Lagos')::date)) days_to_exam,
   'iipmnigeria@gmail.com'::text monitor_copy_email
 from resolved_state s
 left join recovery_orders ro
   on ro.candidate_id=s.candidate_id
  and ro.examination_id=s.examination_id
)
select *
from preview
where state <> 'examination_passed'
order by exam_date,full_name,module_code;
