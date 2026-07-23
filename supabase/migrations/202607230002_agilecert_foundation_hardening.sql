begin;

-- Replace the broad order-status uniqueness rule with a partial uniqueness rule
-- that prevents duplicate open/fulfilled orders while permitting retries and
-- preserving failed/cancelled order history.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'agilecert_certificate_orders'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%eligibility_id%product_code%status%'
  loop
    execute format(
      'alter table public.agilecert_certificate_orders drop constraint if exists %I',
      v_constraint.conname
    );
  end loop;
end;
$$;

create unique index if not exists agilecert_one_open_or_fulfilled_order_idx
  on public.agilecert_certificate_orders(eligibility_id, product_code)
  where status in ('pending', 'initialized', 'paid', 'waived');

-- Ensure public verification never labels a suspended, revoked or expired
-- credential as valid while still returning its auditable lifecycle status.
create or replace function public.verify_agilecert_credential(p_credential_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'valid', c.status = 'active' and (c.expires_at is null or c.expires_at > now()),
        'credentialCode', c.credential_code,
        'verificationSlug', c.verification_slug,
        'holderName', c.holder_name,
        'credentialTitle', c.credential_title,
        'examinationTitle', c.examination_title,
        'score', case when coalesce(p.show_score_publicly, false) then c.score else null end,
        'issueDate', c.issue_date,
        'expiresAt', c.expires_at,
        'status', case
          when c.status = 'active' and c.expires_at is not null and c.expires_at <= now() then 'expired'
          else c.status
        end,
        'issuer', 'AgileCert Global by IIPM',
        'poweredBy', 'Integrated Institute of Professional Management',
        'pathway', 'Independent specialist competency examination',
        'badge', case
          when b.id is null then null
          else jsonb_build_object(
            'badgeCode', b.badge_code,
            'badgeClass', b.badge_class,
            'shareUrl', b.share_url
          )
        end
      )
      from public.agilecert_credentials c
      left join public.agilecert_candidate_profiles p on p.user_id = c.candidate_id
      left join public.agilecert_digital_badges b
        on b.credential_id = c.id
       and b.revoked_at is null
      where lower(c.credential_code) = lower(trim(p_credential_code))
         or lower(c.verification_slug) = lower(trim(p_credential_code))
      limit 1
    ),
    jsonb_build_object('valid', false, 'status', 'not_found')
  );
$$;

-- Use explicit INSERT/UPDATE branches so OLD is never read during INSERT.
create or replace function public.agilecert_stop_certificate_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_should_stop boolean := false;
begin
  if tg_op = 'INSERT' then
    v_should_stop := new.status in ('paid', 'waived');
  elsif tg_op = 'UPDATE' then
    v_should_stop := new.status in ('paid', 'waived') and old.status is distinct from new.status;
  end if;

  if v_should_stop then
    update public.agilecert_automation_jobs
    set
      status = 'cancelled',
      certificate_order_id = new.id,
      updated_at = now()
    where eligibility_id = new.eligibility_id
      and status = 'pending'
      and job_type like 'certificate_%';

    insert into public.agilecert_automation_jobs (
      candidate_id,
      eligibility_id,
      certificate_order_id,
      job_type,
      scheduled_for,
      payload
    )
    values (
      new.candidate_id,
      new.eligibility_id,
      new.id,
      'course_cross_sell',
      now() + interval '1 day',
      jsonb_build_object('source', 'certificate_purchase', 'productCode', new.product_code)
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- Candidate pricing data must be written only by trusted server-side flows.
-- The profile RPC intentionally excludes these columns.
revoke insert, update, delete on public.agilecert_candidate_profiles from authenticated;

-- Automation records are operational data and are never directly writable or
-- readable by candidates. Candidate-facing status is exposed through dedicated RPCs.
revoke all on public.agilecert_automation_jobs from anon, authenticated;
revoke all on public.agilecert_study_materials from anon, authenticated;

comment on index public.agilecert_one_open_or_fulfilled_order_idx is
  'Prevents duplicate pending/paid certificate orders while allowing auditable failed or cancelled retries.';

commit;
