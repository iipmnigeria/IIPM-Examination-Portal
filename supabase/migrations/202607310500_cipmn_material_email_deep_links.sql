begin;

-- Add module-specific calls to action to CIPMN material-ready emails without
-- mutating messages that have already been delivered.
create or replace function public.enrich_cipmn_material_email_deep_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_examination_id text;
begin
  if new.message_type = 'admin_message'
     and new.event_key like 'exam-material-ready:%' then
    v_examination_id := nullif(trim(new.payload ->> 'examinationId'), '');
    if v_examination_id is not null
       and v_examination_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
        'actionLabel', 'Access My Materials',
        'actionUrl', '?view=materials&examinationId=' || v_examination_id
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enrich_cipmn_material_email_deep_link()
  from public, anon, authenticated;

drop trigger if exists agilecert_cipmn_material_email_deep_link
  on public.agilecert_communication_outbox;
create trigger agilecert_cipmn_material_email_deep_link
  before insert or update of message_type, event_key, payload
  on public.agilecert_communication_outbox
  for each row
  execute function public.enrich_cipmn_material_email_deep_link();

update public.agilecert_communication_outbox outbox
set payload = coalesce(outbox.payload, '{}'::jsonb) || jsonb_build_object(
      'actionLabel', 'Access My Materials',
      'actionUrl', '?view=materials&examinationId=' || (outbox.payload ->> 'examinationId')
    ),
    updated_at = now()
where outbox.message_type = 'admin_message'
  and outbox.event_key like 'exam-material-ready:%'
  and outbox.status in ('queued', 'failed')
  and nullif(trim(outbox.payload ->> 'examinationId'), '') is not null
  and (outbox.payload ->> 'examinationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

commit;
