-- Branch-only draft for central CIPMN monitoring-copy configuration.
-- Do not apply to production until dry-run validation and explicit activation approval.

begin;

alter table public.agilecert_communication_settings
  add column if not exists monitor_copy_email text;

update public.agilecert_communication_settings
set monitor_copy_email = 'iipmnigeria@gmail.com',
    updated_at = now()
where singleton = true;

-- Review only. Keep this draft transactional during validation.
rollback;
