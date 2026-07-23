-- AgileCert Global AI Certification Adviser audit
-- Run after migration 202607230013.
-- Read-only.

with checks as (
  select
    'AI session table uses RLS'::text as check_name,
    case when exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'agilecert_ai_chat_sessions'
        and c.relrowsecurity
    ) then 'PASS' else 'FAIL' end as result

  union all

  select
    'AI message table uses RLS',
    case when exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'agilecert_ai_chat_messages'
        and c.relrowsecurity
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'authenticated role cannot read AI sessions directly',
    case when not has_table_privilege(
      'authenticated',
      'public.agilecert_ai_chat_sessions',
      'SELECT'
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'authenticated role cannot read AI messages directly',
    case when not has_table_privilege(
      'authenticated',
      'public.agilecert_ai_chat_messages',
      'SELECT'
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'AI rate-limit function exists',
    case when to_regprocedure('public.register_agilecert_ai_chat_request(text,uuid,integer)') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'AI response audit function exists',
    case when to_regprocedure('public.record_agilecert_ai_chat_response(uuid,uuid,text,text,uuid[],text,boolean,text,text,jsonb)') is not null
      then 'PASS' else 'FAIL' end

  union all

  select
    'session hashes are unique',
    case when not exists (
      select session_key_hash
      from public.agilecert_ai_chat_sessions
      group by session_key_hash
      having count(*) > 1
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'recommended exams reference published examinations',
    case when not exists (
      select 1
      from public.agilecert_ai_chat_messages m,
           unnest(m.recommended_examination_ids) as recommendation_id
      left join public.examinations e on e.id = recommendation_id
      where e.id is null or e.status <> 'published'
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'stored chat messages stay within length limits',
    case when not exists (
      select 1
      from public.agilecert_ai_chat_messages
      where length(user_message) > 4000
         or length(assistant_message) > 12000
    ) then 'PASS' else 'FAIL' end
)
select *
from checks
order by check_name;

select
  coalesce(lead_intent, 'unclassified') as lead_intent,
  escalation_required,
  count(*) as total_messages,
  max(created_at) as latest_message
from public.agilecert_ai_chat_messages
group by coalesce(lead_intent, 'unclassified'), escalation_required
order by total_messages desc;
