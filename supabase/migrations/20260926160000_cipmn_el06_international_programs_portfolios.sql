begin;
-- CIPMN-MOD-EL06 — Managing Successful International Programs and Portfolios
-- Sole source: CIPMN-MOD-012.pptx (39 slides/pages), treated as Elective 6.
do $guard$ declare x uuid:=public.cipmn_mock_seed_uuid('CIPMN-MOD-EL06:EXAM');begin if exists(select 1 from public.examinations where id=x or upper(code)='CIPMN-MOD-EL06') then raise exception 'EL06 exists';end if;end $guard$;
do $exam$ declare x uuid:=public.cipmn_mock_seed_uuid('CIPMN-MOD-EL06:EXAM');begin insert into public.examinations(id,programme_id,title,instructions,duration_minutes,pass_mark,status,max_attempts,randomize_questions,randomize_options,allow_self_enrollment,requires_payment,code,exam_format) values(x,'614ea9d4-0bd4-5df5-a817-9a93937c74e3','CIPMN-MOD-EL06 - Managing Successful International Programs and Portfolios Mock Examination','Complete 25 MCQs then 5 Theory questions. MCQ contributes 40% and Theory 60%.',120,70,'draft',3,true,true,false,true,'CIPMN-MOD-EL06','standard');end $exam$;
commit;
