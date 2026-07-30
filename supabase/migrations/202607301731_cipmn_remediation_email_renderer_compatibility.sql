begin;

-- Reuse the already validated administrator-message renderer so no protected
-- question text or answer-key payload is sent directly to the provider.
create or replace function public.render_cipmn_remediation_as_admin_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_score text;
  v_incorrect text;
  v_question_count text;
  v_highlights text;
begin
  if new.message_type <> 'cipmn_third_attempt_remediation' then
    return new;
  end if;

  v_title := coalesce(nullif(trim(new.payload->>'examinationTitle'), ''), 'CIPMN module examination');
  v_score := coalesce(nullif(trim(new.payload->>'score'), ''), '0');
  v_incorrect := coalesce(nullif(trim(new.payload->>'incorrectCount'), ''), '0');
  v_question_count := coalesce(nullif(trim(new.payload->>'questionCount'), ''), '0');

  select string_agg(format('%s. %s', item.ordinality, item.explanation), E'\n')
  into v_highlights
  from jsonb_array_elements_text(coalesce(new.payload->'reviewHighlights', '[]'::jsonb))
    with ordinality as item(explanation, ordinality);

  new.message_type := 'admin_message';
  new.payload := new.payload || jsonb_build_object(
    'subject', 'Your CIPMN third-attempt remediation review is ready',
    'senderName', 'AgileCert Examination Support',
    'body', concat(
      'You have completed attempt 3 of ', v_title, '.\n\n',
      'Score: ', v_score, '%\n',
      'Responses requiring review: ', v_incorrect, ' of ', v_question_count, '.\n\n',
      case when coalesce(v_highlights, '') = '' then
        'No incorrect responses were recorded. Your secure review remains available in the portal for confirmation.'
      else
        'Key learning explanations from the responses you missed:\n' || v_highlights
      end,
      '\n\nSign in to AgileCert Global to view the protected question-by-question review, including your selected answer, the correct answer and the full explanation. For examination security, the detailed answer key is not reproduced in email.'
    )
  );

  return new;
end;
$$;

revoke all on function public.render_cipmn_remediation_as_admin_message()
  from public, anon, authenticated;

drop trigger if exists render_cipmn_remediation_as_admin_message_trigger
  on public.agilecert_communication_outbox;
create trigger render_cipmn_remediation_as_admin_message_trigger
before insert or update of message_type, payload
on public.agilecert_communication_outbox
for each row execute function public.render_cipmn_remediation_as_admin_message();

commit;
