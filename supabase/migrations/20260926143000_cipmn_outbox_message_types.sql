-- Extend the existing AgileCert communications outbox message-type constraint
-- to allow the CIPMN October 2026 campaign message types.

alter table public.agilecert_communication_outbox
  drop constraint if exists agilecert_communication_outbox_message_type_check;

alter table public.agilecert_communication_outbox
  add constraint agilecert_communication_outbox_message_type_check
  check (
    message_type = any (array[
      'preparation_material_ready'::text,
      'certificate_offer_immediate'::text,
      'certificate_offer_day_2'::text,
      'certificate_offer_day_5'::text,
      'certificate_offer_day_7'::text,
      'certificate_purchase_confirmation'::text,
      'credential_ready'::text,
      'course_recommendation'::text,
      'admin_message'::text,
      'cipmn_exam_preparation'::text,
      'cipmn_payment_recovery'::text,
      'cipmn_unpurchased_modules'::text,
      'cipmn_mock_start'::text,
      'cipmn_mock_resume'::text
    ])
  );
