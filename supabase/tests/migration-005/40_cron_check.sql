-- Supabase image only: verify the cron jobs 005 leaves behind
\set ON_ERROR_STOP 1
DO $$
DECLARE
  v_names text[];
BEGIN
  SELECT array_agg(jobname ORDER BY jobname) INTO v_names FROM cron.job;
  IF v_names IS DISTINCT FROM ARRAY['ledger-sync-periods', 'loan-reminders-daily', 'monthly-email-report'] THEN
    RAISE EXCEPTION 'TEST FAIL: unexpected cron jobs %', v_names;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE command ILIKE '%vault.secrets %' OR command ILIKE '%FROM vault.secrets%') THEN
    RAISE EXCEPTION 'TEST FAIL: a job still reads the encrypted vault.secrets table';
  END IF;
  RAISE NOTICE 'pass: cron jobs = %', v_names;
END $$;

-- The HTTP jobs must at least be valid SQL that queues a request
SELECT vault.create_secret('http://127.0.0.1:9', 'project_url');
SELECT vault.create_secret('sb_secret_test', 'service_key');
DO $$
DECLARE
  v_cmd text;
BEGIN
  FOR v_cmd IN SELECT command FROM cron.job ORDER BY jobname LOOP
    EXECUTE v_cmd;
  END LOOP;
  RAISE NOTICE 'pass: every cron command executes (% queued http requests)',
    (SELECT count(*) FROM net.http_request_queue);
END $$;
