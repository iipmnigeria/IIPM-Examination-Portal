begin;

-- Compatibility helper for AgileCert policies. The existing portal staff
-- contract is `is_exam_staff()`; this wrapper only evaluates the signed-in user
-- and prevents callers from testing arbitrary profile IDs.
create or replace function public.is_staff(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p_user_id = auth.uid()
    and public.is_exam_staff(),
    false
  );
$$;

revoke all on function public.is_staff(uuid) from public;
grant execute on function public.is_staff(uuid) to authenticated;

create or replace function public.queue_agilecert_credential_delivery_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active'
     and new.certificate_storage_path is not null
     and (
       tg_op = 'INSERT'
       or old.certificate_storage_path is distinct from new.certificate_storage_path
     ) then
    insert into public.agilecert_automation_jobs (
      candidate_id,
      eligibility_id,
      certificate_order_id,
      job_type,
      scheduled_for,
      payload
    )
    values (
      new.candidate_id,
      new.eligibility_id,
      new.certificate_order_id,
      'credential_delivery_email',
      new.issued_at,
      jsonb_build_object(
        'source', 'credential_assets_ready',
        'credentialId', new.id,
        'credentialCode', new.credential_code,
        'verificationSlug', new.verification_slug,
        'certificateStoragePath', new.certificate_storage_path,
        'transcriptStoragePath', new.transcript_storage_path
      )
    )
    on conflict (eligibility_id, job_type, scheduled_for) do update
    set
      certificate_order_id = excluded.certificate_order_id,
      payload = public.agilecert_automation_jobs.payload || excluded.payload,
      status = case
        when public.agilecert_automation_jobs.status in ('failed', 'suppressed') then 'pending'
        else public.agilecert_automation_jobs.status
      end,
      scheduled_for = least(public.agilecert_automation_jobs.scheduled_for, now()),
      updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.queue_agilecert_credential_delivery_email() from public;

drop trigger if exists agilecert_queue_credential_delivery_email_trigger
  on public.agilecert_credentials;
create trigger agilecert_queue_credential_delivery_email_trigger
  after insert or update of certificate_storage_path, status
  on public.agilecert_credentials
  for each row
  execute function public.queue_agilecert_credential_delivery_email();

-- Backfill active credentials whose certificate assets were generated before
-- this trigger was installed.
insert into public.agilecert_automation_jobs (
  candidate_id,
  eligibility_id,
  certificate_order_id,
  job_type,
  scheduled_for,
  payload
)
select
  c.candidate_id,
  c.eligibility_id,
  c.certificate_order_id,
  'credential_delivery_email',
  c.issued_at,
  jsonb_build_object(
    'source', 'credential_delivery_backfill',
    'credentialId', c.id,
    'credentialCode', c.credential_code,
    'verificationSlug', c.verification_slug,
    'certificateStoragePath', c.certificate_storage_path,
    'transcriptStoragePath', c.transcript_storage_path
  )
from public.agilecert_credentials c
where c.status = 'active'
  and c.certificate_storage_path is not null
on conflict (eligibility_id, job_type, scheduled_for) do nothing;

comment on function public.queue_agilecert_credential_delivery_email() is
  'Queues one credential-delivery email after the server-generated certificate asset becomes available.';

commit;
