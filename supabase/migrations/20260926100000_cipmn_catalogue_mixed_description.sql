begin;

do $guard$
declare
  v_programme_id constant uuid := '614ea9d4-0bd4-5df5-a817-9a93937c74e3';
  v_code text;
begin
  select code into v_code
  from public.programmes
  where id=v_programme_id
  for update;

  if not found or v_code<>'CIPMN-MOCK' then
    raise exception 'CIPMN-MOCK programme guard failed.';
  end if;
end
$guard$;

update public.programmes
set description='Paid practice examinations for CIPMN professional licensing core and elective modules. Each mixed assessment contains 25 multiple-choice questions and 5 Theory questions, with section-aware scoring and examination integrity controls. These mock examinations support preparation and do not by themselves confer a CIPMN licence.',
    updated_at=now()
where id='614ea9d4-0bd4-5df5-a817-9a93937c74e3'
  and code='CIPMN-MOCK';

do $verify$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.programmes
  where id='614ea9d4-0bd4-5df5-a817-9a93937c74e3'
    and code='CIPMN-MOCK'
    and description='Paid practice examinations for CIPMN professional licensing core and elective modules. Each mixed assessment contains 25 multiple-choice questions and 5 Theory questions, with section-aware scoring and examination integrity controls. These mock examinations support preparation and do not by themselves confer a CIPMN licence.';

  if v_count<>1 then
    raise exception 'CIPMN catalogue description update failed.';
  end if;
end
$verify$;

commit;
