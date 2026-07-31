begin;

-- Approved CIPMN Certificate of Completion template.
-- Replaces the CIPMN achievement-certificate presentation only.
-- Certificate numbers, verification codes, scores, holder records and lifecycle status remain unchanged.

do $$
declare
  v_programme record;
  v_template_id uuid;
  v_version integer;
begin
  for v_programme in
    select p.id, p.code
    from public.programmes p
    where upper(p.code) like 'CIPMN%'
  loop
    update public.agilecert_certificate_templates
    set active = false,
        updated_at = now()
    where programme_id = v_programme.id
      and product_code = 'achievement'
      and active = true;

    select coalesce(max(version), 0) + 1
    into v_version
    from public.agilecert_certificate_templates
    where programme_id = v_programme.id
      and product_code = 'achievement';

    insert into public.agilecert_certificate_templates (
      programme_id,
      product_code,
      template_name,
      version,
      active,
      certificate_title,
      issuer_name,
      subtitle,
      left_signatory_name,
      left_signatory_title,
      right_signatory_name,
      right_signatory_title,
      primary_colour,
      accent_colour,
      layout_config
    ) values (
      v_programme.id,
      'achievement',
      'IIPM and CIPMN Certificate of Completion',
      v_version,
      true,
      'Certificate of Completion',
      'Integrated Institute of Professional Management (IIPM) and Chartered Institute of Project Managers of Nigeria (CIPMN)',
      'CIPMN Licensing Training - jointly branded and publicly verifiable',
      'Eburuche Obinna Chimezie Banito',
      'Programme Coordinator / Executive Director, IIPM',
      'Not Applicable',
      'Approved single-signature template',
      '#08523D',
      '#C69326',
      jsonb_build_object(
        'variant', 'cipmn-completion-v1',
        'institutionIdentity', 'approved-iipm-cipmn-logos',
        'singleSignature', true,
        'showScore', true,
        'showCompletionDate', true,
        'showCertificateNumber', true,
        'showVerificationQr', true
      )
    )
    returning id into v_template_id;

    with migrated as (
      update public.agilecert_issued_certificates certificate
      set template_id = v_template_id,
          template_version = v_version,
          certificate_title = 'Certificate of Completion',
          metadata = coalesce(certificate.metadata, '{}'::jsonb) || jsonb_build_object(
            'templateId', v_template_id,
            'templateVersion', v_version,
            'certificateTemplateVariant', 'cipmn-completion-v1',
            'certificateTemplateMigratedAt', now()
          ),
          updated_at = now()
      from public.examinations examination
      where certificate.examination_id = examination.id
        and examination.programme_id = v_programme.id
        and lower(coalesce(nullif(certificate.metadata->>'productCode', ''), 'achievement')) = 'achievement'
        and certificate.status = 'active'
      returning
        certificate.id,
        certificate.eligibility_id,
        certificate.candidate_id,
        certificate.revision_number
    )
    insert into public.agilecert_certificate_audit_events (
      certificate_id,
      eligibility_id,
      candidate_id,
      actor_id,
      event_type,
      metadata
    )
    select
      migrated.id,
      migrated.eligibility_id,
      migrated.candidate_id,
      null,
      'template_migrated',
      jsonb_build_object(
        'templateId', v_template_id,
        'templateVersion', v_version,
        'variant', 'cipmn-completion-v1',
        'revisionNumber', migrated.revision_number,
        'certificateIdentityChanged', false
      )
    from migrated;
  end loop;
end;
$$;

create or replace function public.get_my_agilecert_certificate_render_payload(
  p_certificate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_certificate public.agilecert_issued_certificates%rowtype;
  v_template public.agilecert_certificate_templates%rowtype;
  v_is_admin boolean := false;
  v_product_code text;
  v_examination_code text;
begin
  if v_user_id is null then
    raise exception 'Sign in to download an issued certificate.';
  end if;

  v_is_admin := public.agilecert_is_certificate_admin();
  select * into v_certificate
  from public.agilecert_issued_certificates
  where id = p_certificate_id
    and (candidate_id = v_user_id or v_is_admin);

  if not found then
    raise exception 'The issued certificate was not found or is not available to this account.';
  end if;
  if v_certificate.status <> 'active' then
    raise exception 'Only an active certificate can be rendered as an active credential.';
  end if;

  select e.code into v_examination_code
  from public.examinations e
  where e.id = v_certificate.examination_id;

  select * into v_template
  from public.agilecert_certificate_templates
  where id = v_certificate.template_id;

  if not found then
    select t.* into v_template
    from public.agilecert_certificate_templates t
    join public.examinations e on e.programme_id = t.programme_id
    where e.id = v_certificate.examination_id
      and t.product_code = lower(coalesce(nullif(v_certificate.metadata->>'productCode', ''), 'achievement'))
      and t.active = true
    order by t.version desc
    limit 1;
  end if;

  v_product_code := lower(coalesce(nullif(v_certificate.metadata->>'productCode', ''), 'achievement'));

  insert into public.agilecert_certificate_audit_events (
    certificate_id, eligibility_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_certificate.id,
    v_certificate.eligibility_id,
    v_certificate.candidate_id,
    v_user_id,
    'pdf_render_requested',
    jsonb_build_object(
      'revisionNumber', v_certificate.revision_number,
      'templateId', v_template.id,
      'templateVersion', v_template.version
    )
  );

  return jsonb_build_object(
    'certificate', jsonb_build_object(
      'id', v_certificate.id,
      'certificateNumber', v_certificate.certificate_number,
      'verificationCode', v_certificate.verification_code,
      'holderName', v_certificate.holder_name,
      'certificateTitle', v_certificate.certificate_title,
      'examinationTitle', v_certificate.examination_title,
      'examinationCode', v_examination_code,
      'programmeCode', v_certificate.programme_code,
      'score', v_certificate.score,
      'passMark', v_certificate.pass_mark,
      'issueDate', v_certificate.issue_date,
      'issuedAt', v_certificate.issued_at,
      'status', v_certificate.status,
      'revisionNumber', v_certificate.revision_number,
      'productCode', v_product_code
    ),
    'template', case when v_template.id is null then null else jsonb_build_object(
      'id', v_template.id,
      'programmeId', v_template.programme_id,
      'productCode', v_template.product_code,
      'templateName', v_template.template_name,
      'version', v_template.version,
      'certificateTitle', v_template.certificate_title,
      'issuerName', v_template.issuer_name,
      'subtitle', v_template.subtitle,
      'leftSignatoryName', v_template.left_signatory_name,
      'leftSignatoryTitle', v_template.left_signatory_title,
      'rightSignatoryName', v_template.right_signatory_name,
      'rightSignatoryTitle', v_template.right_signatory_title,
      'primaryColour', v_template.primary_colour,
      'accentColour', v_template.accent_colour,
      'layoutConfig', v_template.layout_config
    ) end,
    'verificationUrl',
      'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' || v_certificate.verification_code
  );
end;
$$;

revoke all on function public.get_my_agilecert_certificate_render_payload(uuid)
  from public, anon, authenticated;
grant execute on function public.get_my_agilecert_certificate_render_payload(uuid)
  to authenticated;

commit;
