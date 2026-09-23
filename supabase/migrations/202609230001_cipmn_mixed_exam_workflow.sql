begin;

-- CIPMN mixed assessments are opt-in; existing examinations retain the standard flow.
alter table public.examinations
  add column if not exists exam_format text not null default 'standard'
  check (exam_format in ('standard', 'cipmn_mixed'));

alter table public.questions
  drop constraint if exists questions_question_type_check;
alter table public.questions
  add constraint questions_question_type_check
  check (question_type in ('single_choice', 'multiple_choice', 'true_false', 'theory'));

alter table public.questions
  add column if not exists section text not null default 'mcq'
  check (section in ('mcq', 'theory'));

alter table public.candidate_answers
  add column if not exists text_answer text;

alter table public.exam_sessions
  add column if not exists current_section text not null default 'mcq'
  check (current_section in ('mcq', 'theory', 'complete'));
alter table public.exam_sessions
  add column if not exists mcq_submitted_at timestamptz;
alter table public.exam_sessions
  add column if not exists mcq_percentage numeric(5,2)
  check (mcq_percentage is null or mcq_percentage between 0 and 100);

alter table public.attempts
  add column if not exists mcq_percentage numeric(5,2)
  check (mcq_percentage is null or mcq_percentage between 0 and 100);
alter table public.attempts
  add column if not exists theory_percentage numeric(5,2)
  check (theory_percentage is null or theory_percentage between 0 and 100);
alter table public.attempts
  add column if not exists grading_status text not null default 'final'
  check (grading_status in ('mcq_complete', 'pending_theory_review', 'final'));

create table if not exists public.theory_grades (
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  score numeric(8,2) not null default 0,
  feedback text,
  graded_by uuid not null references public.profiles(id),
  graded_at timestamptz not null default now(),
  primary key (session_id, question_id)
);
alter table public.theory_grades enable row level security;
drop policy if exists "staff_manage_theory_grades" on public.theory_grades;
create policy "staff_manage_theory_grades" on public.theory_grades for all
  to authenticated using (public.is_exam_staff()) with check (public.is_exam_staff());
drop policy if exists "candidate_view_own_theory_grades" on public.theory_grades;
create policy "candidate_view_own_theory_grades" on public.theory_grades for select
  to authenticated using (exists (
    select 1 from public.exam_sessions s
    where s.id = theory_grades.session_id and s.candidate_id = auth.uid()
  ));


-- Candidate-facing catalogue/start functions expose section metadata only; answer keys remain isolated.
create or replace function public.get_available_exams()
returns jsonb language sql stable security definer set search_path=public as $
  select coalesce(jsonb_agg(exam_payload order by title),'[]'::jsonb) from (
    select e.title, jsonb_build_object(
      'id',e.id,'title',e.title,'course',p.code,'durationMinutes',e.duration_minutes,
      'questionCount',(select count(*) from public.questions q where q.examination_id=e.id and q.is_active),
      'description',coalesce(p.description,e.instructions,''),'examFormat',e.exam_format,
      'mcqCount',(select count(*) from public.questions q where q.examination_id=e.id and q.is_active and q.section='mcq'),
      'theoryCount',(select count(*) from public.questions q where q.examination_id=e.id and q.is_active and q.section='theory'),
      'questions',coalesce((select jsonb_agg(jsonb_build_object(
        'id',q.id,'text',q.question_text,'type',case when q.question_type='theory' then 'theory' else 'mcq' end,'section',q.section,
        'options',coalesce((select jsonb_agg(qo.option_text order by qo.position) from public.question_options qo where qo.question_id=q.id),'[]'::jsonb)
      ) order by q.position) from public.questions q where q.examination_id=e.id and q.is_active),'[]'::jsonb)
    ) exam_payload
    from public.examinations e join public.programmes p on p.id=e.programme_id
    where e.status='published' and (e.starts_at is null or e.starts_at<=now()) and (e.ends_at is null or e.ends_at>now())
      and (public.is_exam_staff() or e.allow_self_enrollment or exists(select 1 from public.exam_assignments ea where ea.examination_id=e.id and ea.candidate_id=auth.uid() and ea.status='assigned' and (ea.available_from is null or ea.available_from<=now()) and (ea.expires_at is null or ea.expires_at>now())))
  ) x;
$;

create or replace function public.submit_cipmn_mcq_section(
  p_session_id uuid,
  p_answers jsonb,
  p_logs jsonb default '[]'::jsonb,
  p_tab_away_count integer default 0
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_session public.exam_sessions%rowtype;
  v_exam public.examinations%rowtype;
  q record;
  v_idx integer;
  v_option uuid;
  v_raw numeric := 0;
  v_max numeric := 0;
  v_pct numeric := 0;
begin
  select * into v_session from public.exam_sessions where id=p_session_id for update;
  if not found or v_session.candidate_id<>v_uid then raise exception 'The examination session was not found.'; end if;
  if v_session.status<>'active' or v_session.current_section<>'mcq' then raise exception 'The MCQ section is no longer open.'; end if;
  if v_session.expires_at<=now() then raise exception 'The examination session has expired.'; end if;
  select * into v_exam from public.examinations where id=v_session.examination_id;
  if v_exam.exam_format<>'cipmn_mixed' then raise exception 'This examination does not use the CIPMN mixed format.'; end if;

  for q in select id,points from public.questions where examination_id=v_exam.id and is_active and section='mcq' order by position loop
    v_idx:=null; v_option:=null;
    begin v_idx:=nullif(p_answers->>q.id::text,'')::integer; exception when invalid_text_representation then v_idx:=null; end;
    if v_idx is not null and v_idx>=0 then
      select id into v_option from public.question_options where question_id=q.id and position=v_idx+1;
    end if;
    insert into public.candidate_answers(session_id,question_id,selected_option_id,text_answer,client_sequence)
    values(p_session_id,q.id,v_option,null,coalesce(v_idx,-1))
    on conflict(session_id,question_id) do update set selected_option_id=excluded.selected_option_id,text_answer=null,client_sequence=excluded.client_sequence,answered_at=now();
  end loop;

  select coalesce(sum(q.points) filter(where ca.selected_option_id=ak.correct_option_id),0),coalesce(sum(q.points),0)
  into v_raw,v_max
  from public.questions q join public.question_answer_keys ak on ak.question_id=q.id
  left join public.candidate_answers ca on ca.question_id=q.id and ca.session_id=p_session_id
  where q.examination_id=v_exam.id and q.is_active and q.section='mcq';
  if v_max>0 then v_pct:=round(v_raw/v_max*100,2); end if;

  update public.exam_sessions set current_section='theory',mcq_submitted_at=now(),mcq_percentage=v_pct,
    tab_away_count=greatest(tab_away_count,coalesce(p_tab_away_count,0)),updated_at=now()
  where id=p_session_id;

  return jsonb_build_object('sessionId',p_session_id,'mcqScore',v_pct,'currentSection','theory','locked',true);
end $$;

create or replace function public.submit_cipmn_theory_section(
  p_session_id uuid,
  p_answers jsonb,
  p_logs jsonb default '[]'::jsonb,
  p_tab_away_count integer default 0
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=auth.uid();
  v_session public.exam_sessions%rowtype;
  v_exam public.examinations%rowtype;
  v_assignment public.exam_assignments%rowtype;
  q record;
  v_attempt_id uuid;
  v_name text;
begin
  select * into v_session from public.exam_sessions where id=p_session_id for update;
  if not found or v_session.candidate_id<>v_uid then raise exception 'The examination session was not found.'; end if;
  if v_session.status<>'active' or v_session.current_section<>'theory' then raise exception 'The theory section is not open.'; end if;
  select * into v_exam from public.examinations where id=v_session.examination_id;
  if v_exam.exam_format<>'cipmn_mixed' then raise exception 'This examination does not use the CIPMN mixed format.'; end if;
  select * into v_assignment from public.exam_assignments where id=v_session.assignment_id;

  for q in select id from public.questions where examination_id=v_exam.id and is_active and section='theory' order by position loop
    insert into public.candidate_answers(session_id,question_id,selected_option_id,text_answer,client_sequence)
    values(p_session_id,q.id,null,nullif(trim(coalesce(p_answers->>q.id::text,'')),''),0)
    on conflict(session_id,question_id) do update set selected_option_id=null,text_answer=excluded.text_answer,answered_at=now();
  end loop;

  update public.exam_sessions set status='submitted',current_section='complete',submitted_at=now(),
    tab_away_count=greatest(tab_away_count,coalesce(p_tab_away_count,0)),updated_at=now()
  where id=p_session_id;

  insert into public.attempts(session_id,examination_id,candidate_id,raw_score,maximum_score,percentage,status,suspicious_score,started_at,submitted_at,mcq_percentage,theory_percentage,grading_status)
  values(p_session_id,v_exam.id,v_uid,0,0,coalesce(v_session.mcq_percentage,0),'submitted',v_session.suspicious_score,v_session.started_at,now(),v_session.mcq_percentage,null,'pending_theory_review')
  returning id into v_attempt_id;

  update public.exam_assignments set status='completed',updated_at=now() where id=v_assignment.id;
  select full_name into v_name from public.profiles where id=v_uid;

  return jsonb_build_object('id',v_attempt_id,'studentName',coalesce(v_name,'Candidate'),'testId',v_exam.id,'testTitle',v_exam.title,
    'startTime',v_session.started_at,'endTime',now(),'answers',coalesce(p_answers,'{}'::jsonb),'score',v_session.mcq_percentage,
    'mcqScore',v_session.mcq_percentage,'theoryScore',null,'gradingStatus','pending_theory_review','logs',coalesce(p_logs,'[]'::jsonb),
    'status','submitted','suspiciousScore',v_session.suspicious_score);
end $$;

revoke all on function public.get_available_exams() from public;
grant execute on function public.get_available_exams() to authenticated;

revoke all on function public.submit_cipmn_mcq_section(uuid,jsonb,jsonb,integer) from public;
revoke all on function public.submit_cipmn_theory_section(uuid,jsonb,jsonb,integer) from public;
grant execute on function public.submit_cipmn_mcq_section(uuid,jsonb,jsonb,integer) to authenticated;
grant execute on function public.submit_cipmn_theory_section(uuid,jsonb,jsonb,integer) to authenticated;

commit;
