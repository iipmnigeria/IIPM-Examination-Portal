\set ON_ERROR_STOP on

begin;

DO $$
declare
  v_generic_definition text;
  v_professional_definition text;
begin
  select pg_get_functiondef(
    'public.create_agilecert_certificate_order(uuid,text,text)'::regprocedure
  ) into v_generic_definition;

  if position("v_product_code = 'professional'" in v_generic_definition) = 0
     or position('create_agilecert_professional_certificate_order' in v_generic_definition) = 0 then
    raise exception 'The generic certificate-order RPC does not route Professional Certificate requests through identity assurance.';
  end if;

  if position(
    'agilecert_create_no_charge_certificate_order' in v_generic_definition
  ) = 0 or position("'achievement'" in v_generic_definition) = 0 then
    raise exception 'The hardened generic certificate-order RPC did not preserve the Achievement Certificate paid and no-charge routes.';
  end if;

  select pg_get_functiondef(
    'public.create_agilecert_professional_certificate_order(uuid,text)'::regprocedure
  ) into v_professional_definition;

  if position(
    'create_agilecert_professional_certificate_order_phase1b_legacy' in v_professional_definition
  ) = 0
     or position('agilecert_create_no_charge_certificate_order' in v_professional_definition) = 0
     or position('true' in v_professional_definition) = 0 then
    raise exception 'The dedicated Professional Certificate RPC does not preserve paid and identity-assured no-charge routes.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.agilecert_create_no_charge_certificate_order(uuid,text,text,boolean)',
    'execute'
  ) then
    raise exception 'The internal no-charge certificate helper is browser executable.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.create_agilecert_certificate_order(uuid,text,text)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.create_agilecert_professional_certificate_order(uuid,text)',
    'execute'
  ) then
    raise exception 'The approved candidate certificate-order functions are not executable by authenticated candidates.';
  end if;
end;
$$;

select jsonb_build_object(
  'professionalIdentityRouteProtected', true,
  'internalNoChargeHelperProtected', true,
  'transactionRolledBack', true
) as verification;

rollback;
