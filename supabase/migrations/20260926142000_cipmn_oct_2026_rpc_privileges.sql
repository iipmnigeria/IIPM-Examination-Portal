-- Restrict CIPMN October 2026 campaign RPCs to the service role only.
-- Supabase/Postgres functions receive PUBLIC execute by default, and anon/authenticated
-- may also retain inherited/default execute unless explicitly revoked.

revoke execute on function public.preview_cipmn_oct_2026_email_campaign(timestamptz) from public, anon, authenticated;
revoke execute on function public.refresh_cipmn_oct_2026_email_outbox(timestamptz) from public, anon, authenticated;

grant execute on function public.preview_cipmn_oct_2026_email_campaign(timestamptz) to service_role;
grant execute on function public.refresh_cipmn_oct_2026_email_outbox(timestamptz) to service_role;

revoke all on table public.cipmn_oct_2026_email_campaign from public, anon, authenticated;
grant select, insert, update, delete on table public.cipmn_oct_2026_email_campaign to service_role;
