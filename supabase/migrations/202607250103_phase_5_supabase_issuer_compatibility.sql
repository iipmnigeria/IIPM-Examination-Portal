begin;

-- Supabase installs pgcrypto helpers in the extensions schema. The shared
-- Phase 3/4 certificate issuer uses gen_random_bytes() while its original
-- function-level search_path was limited to public. Extending that search path
-- preserves the existing function body and enables both Achievement and
-- Professional credential issuance on Supabase.

alter function public.agilecert_issue_certificate_for_order(uuid, uuid, text)
  set search_path = public, extensions;

comment on function public.agilecert_issue_certificate_for_order(uuid, uuid, text) is
  'Issues a payment- or waiver-authorised AgileCert credential. Search path includes Supabase extensions for pgcrypto random-byte generation.';

commit;
