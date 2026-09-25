-- D5-B: expose candidate-specific CIPMN mixed-exam section progress to the catalogue.
-- Read-only projection only: no examination/session state is mutated here.
create or replace function public.get_available_exams()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with actor as (select auth.uid() as candidate_id),
  catalogue as (
    select
      e.id,e.title,e.duration_minutes,e.instructions,e.exam_format,e.requires_payment,
      p.code as programme_code,p.description as programme_description,
      (
        public.is_exam_staff()
        or exists(
          select 1 from public.exam_assignments ea, actor a
          where ea.examination_id=e.id and ea.candidate_id=a.candidate_id
            and ea.status='assigned'
            and (ea.available_from is null or ea.available_from<=now())
            and (ea.expires_at is null or ea.expires_at>now())
        )
        or exists(
          select 1 from public.exam_orders eo
          join public.exam_payments pay on pay.order_id=eo.id
          cross join actor a
          where eo.examination_id=e.id and eo.candidate_id=a.candidate_id
            and eo.status in ('paid','waived') and pay.status='success'
        )
        or exists(
          select 1 from public.exam_orders eo, actor a
          where eo.examination_id=e.id and eo.candidate_id=a.candidate_id
            and eo.status='waived' and eo.fulfilled_at is not null
        )
        or exists(
          select 1 from public.agilecert_exam_access_grants g, actor a
          where g.examination_id=e.id and g.candidate_id=a.candidate_id
            and g.status in ('active','used') and g.valid_from<=now()
            and (g.valid_to is null or g.valid_to>now())
        )
      ) as can_launch
    from public.examinations e
    join public.programmes p on p.id=e.programme_id
    where e.status='published'
      and (e.starts_at is null or e.starts_at<=now())
      and (e.ends_at is null or e.ends_at>now())
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',c.id,'title',c.title,'course',c.programme_code,'durationMinutes',c.duration_minutes,
      'questionCount',(select count(*) from public.questions q where q.examination_id=c.id and q.is_active),
      'description',coalesce(c.programme_description,c.instructions,''),
      'examFormat',c.exam_format,
      'mcqCount',(select count(*) from public.questions q where q.examination_id=c.id and q.is_active and q.section='mcq'),
      'theoryCount',(select count(*) from public.questions q where q.examination_id=c.id and q.is_active and q.section='theory'),
      'requiresPayment',c.requires_payment,
      'canLaunch',c.can_launch,
      'accessStatus',case when c.can_launch then 'unlocked' when c.requires_payment then 'locked' else 'available' end,
      'sectionProgress',case when c.exam_format='cipmn_mixed' then coalesce((
        select jsonb_build_object(
          'sessionId',s.id,
          'sessionStatus',s.status,
          'currentSection',s.current_section,
          'mcqCompleted',(s.mcq_submitted_at is not null),
          'mcqScore',s.mcq_percentage,
          'theoryReady',(s.status='active' and s.current_section='theory' and s.mcq_submitted_at is not null),
          'updatedAt',s.updated_at
        )
        from public.exam_sessions s, actor a
        where s.examination_id=c.id and s.candidate_id=a.candidate_id
          and (s.mcq_submitted_at is not null or s.current_section='theory')
        order by
          case when s.status='active' and s.current_section='theory' then 0 else 1 end,
          s.updated_at desc
        limit 1
      ), jsonb_build_object(
        'sessionId',null,
        'sessionStatus',null,
        'currentSection','mcq',
        'mcqCompleted',false,
        'mcqScore',null,
        'theoryReady',false,
        'updatedAt',null
      )) else null end,
      'priceAvailable',exists(
        select 1 from public.exam_prices ep
        where ep.examination_id=c.id and ep.is_active
          and ep.effective_from<=now() and (ep.effective_to is null or ep.effective_to>now())
      ),
      'defaultPrice',(
        select jsonb_build_object(
          'id',ep.id,'currency',ep.currency,'amountMinor',ep.amount_minor,
          'countryCodes',ep.country_codes,'isDefault',ep.is_default
        )
        from public.exam_prices ep
        where ep.examination_id=c.id and ep.is_active
          and ep.effective_from<=now() and (ep.effective_to is null or ep.effective_to>now())
        order by ep.is_default desc,case when ep.currency='NGN' then 0 else 1 end,ep.currency
        limit 1
      ),
      'prices',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',ep.id,'currency',ep.currency,'amountMinor',ep.amount_minor,
          'countryCodes',ep.country_codes,'isDefault',ep.is_default
        ) order by ep.is_default desc,ep.currency)
        from public.exam_prices ep
        where ep.examination_id=c.id and ep.is_active
          and ep.effective_from<=now() and (ep.effective_to is null or ep.effective_to>now())
      ),'[]'::jsonb),
      'questions',coalesce((select jsonb_agg(jsonb_build_object(
        'id',q.id,'text',q.question_text,
        'type',case when q.question_type='theory' then 'theory' else 'mcq' end,
        'section',q.section,
        'options',coalesce((select jsonb_agg(qo.option_text order by qo.position) from public.question_options qo where qo.question_id=q.id),'[]'::jsonb)
      ) order by q.position) from public.questions q where q.examination_id=c.id and q.is_active),'[]'::jsonb)
    ) order by c.title
  ),'[]'::jsonb)
  from catalogue c;
$function$;
