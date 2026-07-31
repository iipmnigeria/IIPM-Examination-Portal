\set ON_ERROR_STOP on

begin;

DO $$
declare
  v_generic_oid regprocedure;
  v_professional_oid regprocedure;
  v_legacy_generic_oid regprocedure;
  v_legacy_professional_oid regprocedure;
  v_no_charge_oid regprocedure;
  v_generic_definition text;
  v_professional_definition text;
  v_internal_function regprocedure;
  v_role name;
begin
  v_generic_oid := to_regprocedure(
    'public.create_agilecert_certificate_order(uuid,text,text)'
  );
  v_professional_oid := to_regprocedure(
    'public.create_agilecert_professional_certificate_order(uuid,text)'
  );
  v_legacy_generic_oid := to_regprocedure(
    'public.create_agilecert_certificate_order_phase1b_legacy(uuid,text,text)'
  );
  v_legacy_professional_oid := to_regprocedure(
    'public.create_agilecert_professional_certificate_order_phase1b_legacy(uuid,text)'
  );
  v_no_charge_oid := to_regprocedure(
    'public.agilecert_create_no_charge_certificate_order(uuid,text,text,boolean)'
  );

  if v_generic_oid is null
     or v_professional_oid is null
     or v_legacy_generic_oid is null
     or v_legacy_professional_oid is null
     or v_no_charge_oid is null then
    raise exception 'One or more Phase 1B certificate-order authority functions are missing.';
  end if;

  v_generic_definition := pg_get_functiondef(v_generic_oid);
  v_professional_definition := pg_get_functiondef(v_professional_oid);

  if position(
    'create_agilecert_professional_certificate_order' in v_generic_definition
  ) = 0 then
    raise exception 'The generic certificate-order RPC does not route Professional Certificate requests through the dedicated identity-assured function.';
  end if;

  if position(
    'create_agilecert_certificate_order_phase1b_legacy' in v_generic_definition
  ) = 0
     or position(
       'agilecert_create_no_charge_certificate_order' in v_generic_definition
     ) = 0 then
    raise exception 'The generic certificate-order RPC does not preserve the Achievement Certificate paid and no-charge routes.';
  end if;

  if position(
    'create_agilecert_professional_certificate_order_phase1b_legacy' in v_professional_definition
  ) = 0
     or position(
       'agilecert_create_no_charge_certificate_order' in v_professional_definition
     ) = 0 then
    raise exception 'The dedicated Professional Certificate RPC does not preserve both paid and identity-assured no-charge routes.';
  end if;

  if not has_function_privilege(
    'authenticated',
    v_generic_oid,
    'execute'
  )
     or not has_function_privilege(
       'authenticated',
       v_professional_oid,
       'execute'
     ) then
    raise exception 'The approved candidate certificate-order functions are not executable by authenticated candidates.';
  end if;

  foreach v_internal_function in array array[
    v_legacy_generic_oid,
    v_legacy_professional_oid,
    v_no_charge_oid
  ] loop
    foreach v_role in array array['public'::name, 'anon'::name, 'authenticated'::name] loop
      if has_function_privilege(v_role, v_internal_function, 'execute') then
        raise exception 'Internal certificate function % is executable by role %.',
          v_internal_function,
          v_role;
      end if;
    end loop;
  end loop;
end;
$$;

select jsonb_build_object(
  'professionalIdentityRouteProtected', true,
  'achievementRoutesPreserved', true,
  'internalLegacyFunctionsProtected', true,
  'internalNoChargeHelperProtected', true,
  'approvedCandidateFunctionsExecutable', true,
  'transactionRolledBack', true
) as verification;

rollback;
