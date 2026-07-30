begin;

-- Give CIPMN candidates explicit post-payment instructions without replacing the
-- established communications provider or delivery worker. The existing approved
-- admin_message renderer is reused, while the event key remains compatible with
-- the original preparation_material_ready queue so only one message is sent.

create or replace function public.queue_cipmn_material_access_email(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order record;
  v_subject text;
  v_body text;
  v_outbox_id uuid;
begin
  select
    orders.id,
    orders.candidate_id,
    orders.examination_id,
    orders.reference,
    orders.status,
    orders.fulfilled_at,
    lower(users.email) as recipient_email,
    coalesce(nullif(trim(profile.full_name), ''), 'Candidate') as recipient_name,
    examination.title as examination_title,
    programme.code as programme_code,
    coalesce(preferences.operational_messages, true) as operational_messages
  into v_order
  from public.exam_orders orders
  join auth.users users
    on users.id = orders.candidate_id
   and users.email is not null
  join public.profiles profile
    on profile.id = orders.candidate_id
  join public.examinations examination
    on examination.id = orders.examination_id
  join public.programmes programme
    on programme.id = examination.programme_id
  left join public.agilecert_communication_preferences preferences
    on preferences.candidate_id = orders.candidate_id
  where orders.id = p_order_id;

  if not found
     or v_order.programme_code <> 'CIPMN-MOCK'
     or v_order.status not in ('paid', 'waived')
     or v_order.fulfilled_at is null
     or not v_order.operational_messages then
    return;
  end if;

  insert into public.agilecert_communication_preferences(candidate_id)
  values (v_order.candidate_id)
  on conflict (candidate_id) do nothing;

  v_subject := 'Your ' || v_order.examination_title || ' study materials are ready';
  v_body :=
    'Your verified access for ' || v_order.examination_title || ' is active.' || E'\n\n' ||
    'How to access your materials:' || E'\n' ||
    '1. Sign in to the AgileCert Examination Portal.' || E'\n' ||
    '2. Select Materials from the top menu.' || E'\n' ||
    '3. Open ' || v_order.examination_title || '.' || E'\n' ||
    '4. Download the module PDF and ESG reference, then select Watch video lesson to play the training video.' || E'\n\n' ||
    'Only modules covered by your verified payment, waiver or administrator assignment will be available. Other modules will remain locked.';

  insert into public.agilecert_communication_outbox (
    candidate_id,
    recipient_email,
    recipient_email_hash,
    message_type,
    category,
    event_key,
    due_at,
    status,
    subject,
    payload
  ) values (
    v_order.candidate_id,
    v_order.recipient_email,
    encode(extensions.digest(v_order.recipient_email, 'sha256'), 'hex'),
    'admin_message',
    'operational',
    'exam-material-ready:' || v_order.id::text,
    coalesce(v_order.fulfilled_at, now()),
    'queued',
    v_subject,
    jsonb_build_object(
      'subject', v_subject,
      'body', v_body,
      'recipientName', v_order.recipient_name,
      'senderName', 'AgileCert Global',
      'groupLabel', 'CIPMN study-material access',
      'orderId', v_order.id,
      'examinationId', v_order.examination_id,
      'examinationTitle', v_order.examination_title,
      'reference', v_order.reference
    )
  )
  on conflict (event_key) do update
  set message_type = case
        when public.agilecert_communication_outbox.status in ('queued', 'failed')
          then 'admin_message'
        else public.agilecert_communication_outbox.message_type
      end,
      category = case
        when public.agilecert_communication_outbox.status in ('queued', 'failed')
          then 'operational'
        else public.agilecert_communication_outbox.category
      end,
      subject = case
        when public.agilecert_communication_outbox.status in ('queued', 'failed')
          then excluded.subject
        else public.agilecert_communication_outbox.subject
      end,
      payload = case
        when public.agilecert_communication_outbox.status in ('queued', 'failed')
          then excluded.payload
        else public.agilecert_communication_outbox.payload
      end,
      due_at = case
        when public.agilecert_communication_outbox.status in ('queued', 'failed')
          then least(public.agilecert_communication_outbox.due_at, excluded.due_at)
        else public.agilecert_communication_outbox.due_at
      end,
      next_attempt_at = case
        when public.agilecert_communication_outbox.status = 'failed' then now()
        else public.agilecert_communication_outbox.next_attempt_at
      end,
      failure_code = case
        when public.agilecert_communication_outbox.status = 'failed' then null
        else public.agilecert_communication_outbox.failure_code
      end,
      failure_message = case
        when public.agilecert_communication_outbox.status = 'failed' then null
        else public.agilecert_communication_outbox.failure_message
      end,
      status = case
        when public.agilecert_communication_outbox.status = 'failed' then 'queued'
        else public.agilecert_communication_outbox.status
      end,
      updated_at = now()
  returning id into v_outbox_id;

  insert into public.agilecert_communication_events(
    outbox_id,
    candidate_id,
    event_type,
    metadata
  )
  select
    v_outbox_id,
    v_order.candidate_id,
    'queued',
    jsonb_build_object(
      'messageType', 'admin_message',
      'purpose', 'cipmn_material_access_instructions'
    )
  where not exists (
    select 1
    from public.agilecert_communication_events event
    where event.outbox_id = v_outbox_id
      and event.event_type = 'queued'
  );
end;
$$;

revoke all on function public.queue_cipmn_material_access_email(uuid)
  from public, anon, authenticated;
grant execute on function public.queue_cipmn_material_access_email(uuid)
  to service_role;

create or replace function public.queue_cipmn_material_access_email_after_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('paid', 'waived')
     and new.fulfilled_at is not null
     and (
       tg_op = 'INSERT'
       or new.status is distinct from old.status
       or new.fulfilled_at is distinct from old.fulfilled_at
     ) then
    perform public.queue_cipmn_material_access_email(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.queue_cipmn_material_access_email_after_order()
  from public, anon, authenticated;

drop trigger if exists agilecert_cipmn_material_access_email_after_order
  on public.exam_orders;
create trigger agilecert_cipmn_material_access_email_after_order
  after insert or update of status, fulfilled_at
  on public.exam_orders
  for each row
  execute function public.queue_cipmn_material_access_email_after_order();

-- Upgrade unsent historical CIPMN preparation confirmations and seed any fulfilled
-- CIPMN orders that do not yet have a queue record. Sent records remain immutable.
do $seed$
declare
  v_order record;
begin
  for v_order in
    select orders.id
    from public.exam_orders orders
    join public.examinations examination on examination.id = orders.examination_id
    join public.programmes programme on programme.id = examination.programme_id
    where programme.code = 'CIPMN-MOCK'
      and orders.status in ('paid', 'waived')
      and orders.fulfilled_at is not null
  loop
    perform public.queue_cipmn_material_access_email(v_order.id);
  end loop;
end;
$seed$;

commit;
