begin;

-- CIPMN Professional Licensing Module Mock Examinations.
-- Twelve paid mock examinations, 75 case/application MCQs each (900 total).
-- Current standard AgileCert/IIPM examination fee: NGN 25,000 (2,500,000 kobo).

create or replace function public.cipmn_mock_seed_uuid(p_seed text)
returns uuid language sql immutable set search_path = public as $$
  select (substr(h,1,8)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4)||'-'||substr(h,21,12))::uuid
  from (select md5(p_seed) h) s;
$$;
revoke all on function public.cipmn_mock_seed_uuid(text) from public;

insert into public.programmes (id,code,name,description,is_active)
values (
  '614ea9d4-0bd4-5df5-a817-9a93937c74e3'::uuid,
  'CIPMN-MOCK',
  'CIPMN Professional Licensing Module Mock Examinations',
  'Paid practice examinations for the twelve CIPMN professional licensing modules. Each module contains 75 case-based and application-focused multiple-choice questions. These mock examinations support preparation and do not by themselves confer a CIPMN licence.',
  true
)
on conflict (code) do update set
  name=excluded.name, description=excluded.description, is_active=true, updated_at=now();

do $catalogue$
declare
  v_programme_id uuid;
  v_module jsonb;
  v_exam_id uuid;
  v_price_id uuid;
begin
  select id into v_programme_id from public.programmes where code='CIPMN-MOCK';
  for v_module in select value from jsonb_array_elements('[{"code":"CIPMN-MOD-001","title":"Principles of Project Management","exam_id":"2e5fea8b-a4de-5c61-9a43-e53e9d28403f","price_id":"1e0908e0-c980-5f81-a686-37c2be91c01e"},{"code":"CIPMN-MOD-002","title":"Understanding Project Management Methodologies","exam_id":"fe7a116b-72ef-5d1f-acc8-36938ee8b0cf","price_id":"3dfc134c-5989-5e10-ac07-5165c6a9f015"},{"code":"CIPMN-MOD-003","title":"Project Delivery Conceptual Tools","exam_id":"916ed55c-e157-5e23-9d46-43ad4e2b9c2a","price_id":"2ad86dcb-16f9-5cf2-92bf-fdee807d03cd"},{"code":"CIPMN-MOD-004","title":"Requirements Engineering in Project Management","exam_id":"5322572d-27b0-5467-ab89-c6b45612b960","price_id":"0cbe617b-427c-53ce-8f49-4232b7140e9d"},{"code":"CIPMN-MOD-005","title":"Project Risk and Issues Management","exam_id":"d0c77c9c-a711-5864-97ac-c930ca231773","price_id":"ab34bc2e-df2d-5dbc-af24-179f421fa016"},{"code":"CIPMN-MOD-006","title":"Project Planning and Scheduling","exam_id":"63311ad6-4bc2-59b6-a5fd-283423c4a2ac","price_id":"bc5a8cc1-41d1-5bf7-af0f-ddb69c377d5f"},{"code":"CIPMN-MOD-007","title":"Project Scope and Change Management","exam_id":"a573f28c-a38a-5978-a6a9-42b1d8239935","price_id":"5b2bce84-3cc0-57db-b089-8a777b4eab3b"},{"code":"CIPMN-MOD-008","title":"Project Quality Management","exam_id":"2eec289b-9c0b-57e4-a2c6-e288fa6d4a28","price_id":"aa7e9b0b-3382-50f0-bf8c-ad581636b4b9"},{"code":"CIPMN-MOD-009","title":"Agile Delivery","exam_id":"8305ebe1-ea1e-5089-bf4c-cb5bac29a918","price_id":"61332869-5ef6-5c96-94d7-81da342507dd"},{"code":"CIPMN-MOD-010","title":"Project Leadership and Building High-Performing Teams","exam_id":"37eaf7f3-42c8-525c-8c28-cd9c3327da13","price_id":"5997c8ec-0cac-5e56-9930-b15c0ab1dd4d"},{"code":"CIPMN-MOD-011","title":"Understanding DUCAP Methodology","exam_id":"6561efd6-938e-5da0-aae3-520349741cc9","price_id":"6857fff0-9614-546d-87f0-3493a77b98a2"},{"code":"CIPMN-MOD-012","title":"Managing Successful International Programs and Portfolios","exam_id":"5c49847b-3944-5034-b620-0a3c5a1c7523","price_id":"ad94218e-184e-567e-863f-997fc1256dc0"}]'::jsonb)
  loop
    v_exam_id := (v_module->>'exam_id')::uuid;
    v_price_id := (v_module->>'price_id')::uuid;
    insert into public.examinations (
      id,programme_id,title,instructions,duration_minutes,pass_mark,status,max_attempts,
      randomize_questions,randomize_options,allow_self_enrollment,requires_payment
    ) values (
      v_exam_id,v_programme_id,
      (v_module->>'code')||' - '||(v_module->>'title')||' Mock Examination',
      'Answer all 75 questions. Select the most appropriate response for each case or application scenario. This paid mock examination is timed and protected by AgileCert/IIPM examination integrity controls. Payment, an applicable coupon or an administrator assignment is required before launch. Passing this mock examination does not by itself confer a CIPMN licence.',
      120,50,'published',1,true,true,false,true
    )
    on conflict (id) do update set
      programme_id=excluded.programme_id,title=excluded.title,instructions=excluded.instructions,
      duration_minutes=120,pass_mark=50,status='published',max_attempts=1,
      randomize_questions=true,randomize_options=true,allow_self_enrollment=false,
      requires_payment=true,updated_at=now();

    update public.exam_prices set is_default=false,updated_at=now()
    where examination_id=v_exam_id and currency<>'NGN' and is_default=true;

    insert into public.exam_prices (
      id,examination_id,currency,amount_minor,country_codes,is_default,is_active,effective_from,effective_to
    ) values (v_price_id,v_exam_id,'NGN',2500000,array['NG']::text[],true,true,now(),null)
    on conflict (examination_id,currency) do update set
      amount_minor=2500000,country_codes=array['NG']::text[],is_default=true,is_active=true,
      effective_from=least(public.exam_prices.effective_from,now()),effective_to=null,updated_at=now();
  end loop;
end;
$catalogue$;

create or replace function public.seed_cipmn_mock_module(p_module_code text,p_cards jsonb)
returns void language plpgsql set search_path=public as $seed$
declare
  v_exam_id uuid;
  v_count integer;
begin
  if p_module_code !~ '^CIPMN-MOD-[0-9]{3}$' then raise exception 'Invalid CIPMN module code: %',p_module_code; end if;
  if jsonb_typeof(p_cards)<>'array' or jsonb_array_length(p_cards)<>15 then
    raise exception '% requires exactly 15 topic cards.',p_module_code;
  end if;
  select e.id into v_exam_id from public.examinations e join public.programmes p on p.id=e.programme_id
  where p.code='CIPMN-MOCK' and e.title like p_module_code||' - %' limit 1;
  if v_exam_id is null then raise exception 'Mock examination for % not found.',p_module_code; end if;

  drop table if exists pg_temp.cipmn_cards;
  drop table if exists pg_temp.cipmn_generated;
  create temporary table cipmn_cards(
    pos int primary key,topic text not null,situation text not null,correct_action text not null,
    d1 text not null,d2 text not null,d3 text not null,explanation text not null
  ) on commit drop;
  insert into cipmn_cards
  select ordinality::int,x->>0,x->>1,x->>2,x->>3,x->>4,x->>5,x->>6
  from jsonb_array_elements(p_cards) with ordinality t(x,ordinality);

  create temporary table cipmn_generated(
    pos int primary key,qid uuid not null,qtext text not null,o1 text not null,o2 text not null,
    o3 text not null,o4 text not null,correct_pos int not null check(correct_pos between 1 and 4),
    explanation text not null
  ) on commit drop;

  with contexts as (
    select * from (values
      (1,'action','A Nigerian public-sector project is under review. ',' Which response should the project manager take first?'),
      (2,'action','A health-sector programme team faces this management challenge. ',' Which action best applies the relevant professional practice?'),
      (3,'action','An ICT delivery team must decide how to proceed. ',' Which decision would best protect project value and delivery confidence?'),
      (4,'reason','An infrastructure contractor reports the issue during a progress meeting. ',' Which explanation best justifies the appropriate professional response?'),
      (5,'concept','A donor-funded initiative encounters this situation while working with multiple stakeholders. ',' Which module concept should most directly guide the response?')
    ) v(variant,kind,prefix,suffix)
  ), expanded as (
    select c.*,x.*,((c.pos-1)*5+x.variant) qpos,1+((c.pos*3+x.variant)%4) correct_pos,
      array(select c2.topic from cipmn_cards c2 where c2.pos<>c.pos
            order by md5(p_module_code||':'||c.pos::text||':'||c2.pos::text) limit 3) cd
    from cipmn_cards c cross join contexts x
  ), sourced as (
    select e.*,case e.kind
      when 'action' then array[e.correct_action,e.d1,e.d2,e.d3]
      when 'reason' then array[e.explanation,
        'The response avoids documentation and therefore allows unrestricted flexibility.',
        'The response ensures that seniority replaces evidence and agreed governance.',
        'The response removes the need to assess impacts, stakeholders or intended value.']
      else array[e.topic,e.cd[1],e.cd[2],e.cd[3]] end src
    from expanded e
  ), arranged as (
    select s.qpos,public.cipmn_mock_seed_uuid(p_module_code||':q:'||s.qpos::text) qid,
      s.prefix||s.situation||s.suffix qtext,s.correct_pos,s.explanation,
      array(select case when op=s.correct_pos then s.src[1]
                        when op<s.correct_pos then s.src[op+1] else s.src[op] end
            from generate_series(1,4) g(op) order by op) opts
    from sourced s
  )
  insert into cipmn_generated
  select qpos,qid,qtext,opts[1],opts[2],opts[3],opts[4],correct_pos,explanation from arranged;

  if (select count(*) from cipmn_generated)<>75 then raise exception '% did not generate 75 questions.',p_module_code; end if;
  if exists(select 1 from cipmn_generated group by qtext having count(*)>1) then raise exception '% has duplicate question text.',p_module_code; end if;

  -- Retire any earlier bank and move it beyond its current maximum position before upsert.
  with base as (
    select coalesce(max(position),0)+1000 as offset
    from public.questions where examination_id=v_exam_id
  ), r as (
    select q.id,base.offset+row_number() over(order by q.position,q.id) as retired_position
    from public.questions q cross join base where q.examination_id=v_exam_id
  ) update public.questions q set is_active=false,position=r.retired_position,updated_at=now()
    from r where q.id=r.id;

  insert into public.questions(id,examination_id,question_text,position,points,is_active)
  select qid,v_exam_id,qtext,pos,1,true from cipmn_generated
  on conflict(id) do update set examination_id=excluded.examination_id,question_text=excluded.question_text,
    position=excluded.position,points=1,is_active=true,updated_at=now();

  -- Deterministic questions own deterministic options; remove stale protected keys first.
  delete from public.question_answer_keys k using cipmn_generated g where k.question_id=g.qid;
  delete from public.question_options qo using cipmn_generated g where qo.question_id=g.qid;
  insert into public.question_options(id,question_id,option_text,position)
  select public.cipmn_mock_seed_uuid(p_module_code||':q:'||g.pos::text||':o:'||o.pos::text),g.qid,o.txt,o.pos
  from cipmn_generated g cross join lateral(values(1,g.o1),(2,g.o2),(3,g.o3),(4,g.o4)) o(pos,txt);

  insert into public.question_answer_keys(question_id,correct_option_id,explanation)
  select g.qid,public.cipmn_mock_seed_uuid(p_module_code||':q:'||g.pos::text||':o:'||g.correct_pos::text),g.explanation
  from cipmn_generated g
  on conflict(question_id) do update set correct_option_id=excluded.correct_option_id,
    explanation=excluded.explanation,updated_at=now();

  select count(*) into v_count from public.questions where examination_id=v_exam_id and is_active=true;
  if v_count<>75 then raise exception '% contains % active questions, expected 75.',p_module_code,v_count; end if;
  if exists(
    select 1 from public.questions q left join lateral(
      select count(*) n from public.question_options qo where qo.question_id=q.id
    ) o on true left join public.question_answer_keys k on k.question_id=q.id
    where q.examination_id=v_exam_id and q.is_active=true and (o.n<>4 or k.correct_option_id is null)
  ) then raise exception '% contains an incomplete question.',p_module_code; end if;
end;
$seed$;
revoke all on function public.seed_cipmn_mock_module(text,jsonb) from public;

commit;
