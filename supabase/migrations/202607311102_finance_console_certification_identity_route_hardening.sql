begin;

-- ---------------------------------------------------------------------------
-- Finance Console Phase 1B hardening: the generic certificate-order RPC must
-- never provide an alternate route around Professional Certificate identity
-- assurance, including when certification is configured as included or free.
-- ---------------------------------------------------------------------------

create or replace function public.create_agilecert_certificate_order(
  p_eligibility_id uuid,
  p_product_code text,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_pricing jsonb;
begin
  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select a valid certificate product.';
  end if;

  -- The dedicated Professional Certificate function is the sole public route
  -- for that product. It preserves approved identity assurance for paid,
  -- included and free certification modes.
  if v_product_code = 'professional' then
    return public.create_agilecert_professional_certificate_order(
      p_eligibility_id,
      p_currency
    );
  end if;

  v_pricing := public.agilecert_resolve_certificate_pricing(
    auth.uid(),
    p_eligibility_id,
    'achievement',
    p_currency
  );

  if (v_pricing ->> 'paymentRequired')::boolean then
    return public.create_agilecert_certificate_order_phase1b_legacy(
      p_eligibility_id,
      'achievement',
      p_currency
    );
  end if;

  return public.agilecert_create_no_charge_certificate_order(
    p_eligibility_id,
    'achievement',
    p_currency,
    false
  );
end;
$$;

revoke all on function public.create_agilecert_certificate_order(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_agilecert_certificate_order(uuid, text, text)
  to authenticated;

comment on function public.create_agilecert_certificate_order(uuid, text, text) is
  'Candidate certificate-order authority. Professional requests are always routed through the identity-assured Professional Certificate function.';

notify pgrst, 'reload schema';

commit;
