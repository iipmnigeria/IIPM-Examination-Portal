begin;

create or replace function public.enforce_agilecert_candidate_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The mandatory gate protects new candidate operations. It must not block
  -- controlled restoration/import of already-paid orders or historical sessions.
  if tg_table_name = 'exam_sessions' and coalesce(new.status, '') <> 'active' then
    return new;
  end if;

  if tg_table_name = 'exam_orders' and coalesce(new.status, '') not in ('pending', 'processing') then
    return new;
  end if;

  if not public.agilecert_candidate_profile_is_complete(new.candidate_id) then
    raise exception 'Complete your mandatory candidate profile before purchasing or starting an examination.';
  end if;
  return new;
end;
$$;

comment on function public.enforce_agilecert_candidate_onboarding() is
  'Blocks new pending/processing examination purchases and active examination sessions until mandatory candidate onboarding is complete, while permitting controlled historical imports.';

commit;
