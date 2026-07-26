begin;

-- Original Roadmap Phase 4, unit 5 of 5:
-- sanitize the public employer/institution response without weakening the richer
-- authenticated candidate and administrator wallet payloads.

alter function public.verify_agilecert_professional_record(text)
  rename to verify_agilecert_professional_record_internal;

revoke all on function public.verify_agilecert_professional_record_internal(text)
  from public, anon, authenticated;

create or replace function public.verify_agilecert_professional_record(
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_credentials jsonb;
begin
  v_result := public.verify_agilecert_professional_record_internal(p_code);

  if jsonb_typeof(v_result->'credentials') = 'array' then
    select coalesce(jsonb_agg(
      credential
        - 'credentialId'
        - 'orderId'
        - 'candidateId'
        - 'candidateEmail'
        - 'paymentAmount'
        - 'transactionReference'
        - 'providerPayload'
    ), '[]'::jsonb)
    into v_credentials
    from jsonb_array_elements(v_result->'credentials') credential;

    v_result := jsonb_set(v_result, '{credentials}', v_credentials, true);
  end if;

  return v_result
    - 'credentialId'
    - 'orderId'
    - 'candidateId'
    - 'candidateEmail'
    - 'paymentAmount'
    - 'transactionReference'
    - 'providerPayload';
end;
$$;

revoke all on function public.verify_agilecert_professional_record(text) from public;
grant execute on function public.verify_agilecert_professional_record(text)
  to anon, authenticated;

commit;
