-- AgileCert Global automation scheduler configuration
--
-- Run only after:
-- 1. `process-agilecert-automation` has been deployed.
-- 2. The following Supabase Vault secrets have been created in the Dashboard:
--      agilecert_automation_worker_url
--      agilecert_automation_worker_secret
--
-- Suggested URL value:
-- https://cfecicvugfrrhcvhduzc.supabase.co/functions/v1/process-agilecert-automation
--
-- Never place the worker secret in GitHub or directly inside this SQL file.

create extension if not exists pg_cron;
create extension if not exists pg_net;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'agilecert_automation_worker_url'
      AND nullif(trim(decrypted_secret), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Vault secret agilecert_automation_worker_url is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'agilecert_automation_worker_secret'
      AND nullif(trim(decrypted_secret), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Vault secret agilecert_automation_worker_secret is missing.';
  END IF;
END;
$$;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'agilecert-process-automation'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'agilecert-process-automation',
  '*/10 * * * *',
  $cron$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'agilecert_automation_worker_url'
        LIMIT 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-agilecert-automation-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'agilecert_automation_worker_secret'
          LIMIT 1
        )
      ),
      body := jsonb_build_object(
        'limit', 25,
        'workerId', 'supabase-cron'
      ),
      timeout_milliseconds := 25000
    );
  $cron$
);

SELECT
  jobid,
  jobname,
  schedule,
  active,
  database,
  username,
  command
FROM cron.job
WHERE jobname = 'agilecert-process-automation';
