begin;

-- Correct the approved pass mark for all CIPMN professional licensing
-- module mock examinations from 50% to 70%.

do $$
declare
  v_programme_id uuid;
  v_updated_count integer;
begin
  select p.id
  into v_programme_id
  from public.programmes p
  where p.code = 'CIPMN-MOCK'
    and p.is_active = true
  limit 1;

  if v_programme_id is null then
    raise exception 'The CIPMN-MOCK programme was not found.';
  end if;

  update public.examinations
  set pass_mark = 70,
      updated_at = now()
  where programme_id = v_programme_id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 12 then
    raise exception 'Expected to update 12 CIPMN module mock examinations, updated %.', v_updated_count;
  end if;

  if exists (
    select 1
    from public.examinations e
    where e.programme_id = v_programme_id
      and e.pass_mark <> 70
  ) then
    raise exception 'One or more CIPMN module mock examinations do not have a 70%% pass mark.';
  end if;
end;
$$;

commit;
