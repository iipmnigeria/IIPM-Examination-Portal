begin;

-- PostgreSQL treats a bare table alias in SELECT as one composite value. Expand
-- row aliases when assigning into %rowtype variables so each field is assigned
-- to the matching record column.
do $fix$
declare
  v_definition text;
  v_corrected text;
begin
  select pg_get_functiondef(
    'public.agilecert_prepare_cipmn_third_attempt_review(uuid)'::regprocedure
  ) into v_definition;

  v_corrected := replace(v_definition, 'select a into v_attempt', 'select a.* into v_attempt');
  v_corrected := replace(v_corrected, 'select e into v_exam', 'select e.* into v_exam');

  if v_corrected = v_definition then
    raise exception 'The CIPMN remediation preparation function did not contain the expected composite-row selections.';
  end if;
  execute v_corrected;

  select pg_get_functiondef(
    'public.get_my_cipmn_attempt_review(uuid)'::regprocedure
  ) into v_definition;

  v_corrected := replace(v_definition, 'select a into v_attempt', 'select a.* into v_attempt');
  v_corrected := replace(v_corrected, 'select e into v_exam', 'select e.* into v_exam');
  v_corrected := replace(v_corrected, 'select review into v_review', 'select review.* into v_review');

  if v_corrected = v_definition then
    raise exception 'The candidate CIPMN review function did not contain the expected composite-row selections.';
  end if;
  execute v_corrected;
end;
$fix$;

commit;
