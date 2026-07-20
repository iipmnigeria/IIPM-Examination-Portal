begin;

-- A browser session may update only harmless candidate profile fields.
-- Role, account status, email and candidate codes are controlled by privileged server operations.
revoke insert, delete, truncate, references, trigger on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Correct answers must never be retrievable through a browser JWT, including staff JWTs.
-- Examination authoring and grading should access this table through protected Edge Functions.
revoke all on public.question_answer_keys from authenticated;

-- Official session, answer, grading, proctoring and audit writes are server-controlled.
revoke insert, update, delete on public.exam_sessions from authenticated;
grant select on public.exam_sessions to authenticated;

revoke insert, update, delete on public.candidate_answers from authenticated;
grant select on public.candidate_answers to authenticated;

revoke insert, delete on public.attempts from authenticated;
grant select, update on public.attempts to authenticated;

revoke insert, update, delete on public.proctor_events from authenticated;
grant select on public.proctor_events to authenticated;

revoke insert, update, delete on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service-role/database operations have no authenticated end-user UID and may proceed.
  if auth.uid() is null then
    return new;
  end if;

  if new.id <> old.id then
    raise exception 'Profile identity cannot be changed.';
  end if;

  if new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.is_active is distinct from old.is_active
     or new.candidate_code is distinct from old.candidate_code then
    raise exception 'Privileged profile fields can be changed only by an authorised server operation.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_escalation_trigger on public.profiles;
create trigger prevent_profile_privilege_escalation_trigger
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

commit;
