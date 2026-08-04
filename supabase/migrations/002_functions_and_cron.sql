-- ============================================================
-- Budget Engine Functions + pg_cron Scheduled Jobs
-- Run this AFTER 001_initial_schema.sql
-- Requires pg_cron and pg_net extensions enabled in Supabase
-- ============================================================

-- ============ BUDGET ENGINE FUNCTIONS ============

-- Open new category_periods for all active categories (called 1st of month)
CREATE OR REPLACE FUNCTION open_new_periods(p_month int DEFAULT NULL, p_year int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_month int := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int);
  v_year  int := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_category RECORD;
BEGIN
  FOR v_category IN
    SELECT c.id AS category_id, c.user_id, c.monthly_budget_amount
    FROM categories c
    WHERE c.is_active = true
  LOOP
    -- Upsert: do nothing if already exists (idempotent)
    INSERT INTO category_periods (user_id, category_id, month, year, budgeted_amount)
    VALUES (v_category.user_id, v_category.category_id, v_month, v_year, v_category.monthly_budget_amount)
    ON CONFLICT (user_id, category_id, month, year) DO NOTHING;

    -- Ensure a stack row exists for each category
    INSERT INTO category_stacks (user_id, category_id, current_balance)
    VALUES (v_category.user_id, v_category.category_id, 0)
    ON CONFLICT (user_id, category_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Close periods + accrue unused budget to stacks (called last day of month)
CREATE OR REPLACE FUNCTION close_periods_and_accrue_stacks(p_month int DEFAULT NULL, p_year int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_month int := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int);
  v_year  int := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_period RECORD;
  v_unused numeric;
BEGIN
  FOR v_period IN
    SELECT cp.id, cp.user_id, cp.category_id,
           cp.budgeted_amount, cp.rollover_in, cp.spent_amount
    FROM category_periods cp
    WHERE cp.month = v_month
      AND cp.year = v_year
      AND cp.closed = false
  LOOP
    v_unused := v_period.budgeted_amount + v_period.rollover_in - v_period.spent_amount;

    IF v_unused > 0 THEN
      -- Add unused to stack
      UPDATE category_stacks
      SET current_balance = current_balance + v_unused,
          last_updated = now()
      WHERE user_id = v_period.user_id
        AND category_id = v_period.category_id;

      -- Log the accrual
      INSERT INTO stack_transactions (user_id, category_id, type, amount, month, year, comment)
      VALUES (
        v_period.user_id,
        v_period.category_id,
        'accrual',
        v_unused,
        v_month,
        v_year,
        'Month-end rollover: unused budget accrued to stack'
      );
    END IF;

    -- Mark period closed
    UPDATE category_periods
    SET closed = true, closed_at = now()
    WHERE id = v_period.id;
  END LOOP;
END;
$$;

-- Process loan reminders (called daily)
CREATE OR REPLACE FUNCTION get_due_loan_reminders()
RETURNS TABLE (
  loan_id uuid,
  user_id uuid,
  borrower_name text,
  amount numeric,
  date_lent date,
  reason text,
  reminder_date date,
  days_overdue int,
  user_email text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS loan_id,
    l.user_id,
    l.borrower_name,
    l.amount,
    l.date_lent,
    l.reason,
    l.reminder_date,
    (CURRENT_DATE - l.reminder_date)::int AS days_overdue,
    au.email AS user_email
  FROM loans l
  JOIN auth.users au ON au.id = l.user_id
  WHERE l.status != 'repaid'
    AND l.reminder_date <= CURRENT_DATE;
END;
$$;

-- Reallocate from stacks (atomic, called from server action)
CREATE OR REPLACE FUNCTION reallocate_stack(
  p_user_id uuid,
  p_sources jsonb,  -- [{category_id, amount}]
  p_dest_type text, -- 'stack' | 'period' | 'stock'
  p_dest_category_id uuid DEFAULT NULL,
  p_dest_period_month int DEFAULT NULL,
  p_dest_period_year int DEFAULT NULL,
  p_stock_purchase_id uuid DEFAULT NULL,
  p_comment text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_source jsonb;
  v_src_category_id uuid;
  v_src_amount numeric;
  v_total numeric := 0;
BEGIN
  -- Validate comment required
  IF p_comment IS NULL OR trim(p_comment) = '' THEN
    RAISE EXCEPTION 'Comment is required for all stack reallocations';
  END IF;

  -- Process each source
  FOR v_source IN SELECT * FROM jsonb_array_elements(p_sources)
  LOOP
    v_src_category_id := (v_source->>'category_id')::uuid;
    v_src_amount := (v_source->>'amount')::numeric;

    -- Check balance (server-side guard against going negative)
    IF NOT EXISTS (
      SELECT 1 FROM category_stacks
      WHERE user_id = p_user_id
        AND category_id = v_src_category_id
        AND current_balance >= v_src_amount
    ) THEN
      RAISE EXCEPTION 'Insufficient stack balance for category %', v_src_category_id;
    END IF;

    -- Deduct from source stack
    UPDATE category_stacks
    SET current_balance = current_balance - v_src_amount,
        last_updated = now()
    WHERE user_id = p_user_id AND category_id = v_src_category_id;

    -- Log reallocation_out
    INSERT INTO stack_transactions (
      user_id, category_id, type, amount,
      related_category_id, related_stock_purchase_id, comment
    ) VALUES (
      p_user_id, v_src_category_id, 'reallocation_out', v_src_amount,
      p_dest_category_id, p_stock_purchase_id, p_comment
    );

    v_total := v_total + v_src_amount;
  END LOOP;

  -- Apply to destination
  CASE p_dest_type
    WHEN 'stack' THEN
      UPDATE category_stacks
      SET current_balance = current_balance + v_total,
          last_updated = now()
      WHERE user_id = p_user_id AND category_id = p_dest_category_id;

      INSERT INTO stack_transactions (user_id, category_id, type, amount, comment)
      VALUES (p_user_id, p_dest_category_id, 'reallocation_in', v_total, p_comment);

    WHEN 'period' THEN
      UPDATE category_periods
      SET rollover_in = rollover_in + v_total
      WHERE user_id = p_user_id
        AND category_id = p_dest_category_id
        AND month = p_dest_period_month
        AND year = p_dest_period_year
        AND closed = false;

      INSERT INTO stack_transactions (
        user_id, category_id, type, amount, month, year, comment
      ) VALUES (
        p_user_id, p_dest_category_id, 'pulled_to_period', v_total,
        p_dest_period_month, p_dest_period_year, p_comment
      );

    WHEN 'stock' THEN
      -- Stock purchase row already created by caller; just log handled
      NULL;

    ELSE
      RAISE EXCEPTION 'Invalid destination type: %', p_dest_type;
  END CASE;
END;
$$;

-- Enable extensions required for scheduled background jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============ pg_cron SCHEDULED JOBS ============
-- Note: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY below with your actual values if setting up Vault secrets,
-- or run the schedule commands after deploying your Edge Functions.

-- 1st of every month at 00:00 UTC
-- We call the Edge Function which calls open_new_periods()
SELECT cron.schedule(
  'open-new-periods',
  '0 0 1 * *',
  $$
  SELECT net.http_post(
    url := (SELECT secret FROM vault.secrets WHERE name = 'project_url') || '/functions/v1/open-periods',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret FROM vault.secrets WHERE name = 'service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Last day of every month at 23:45 IST (18:15 UTC)
SELECT cron.schedule(
  'close-periods-accrue-stacks',
  '15 18 28-31 * *',
  $$
  SELECT net.http_post(
    url := (SELECT secret FROM vault.secrets WHERE name = 'project_url') || '/functions/v1/close-periods',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret FROM vault.secrets WHERE name = 'service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Daily at 09:00 IST (03:30 UTC) for loan reminders
SELECT cron.schedule(
  'loan-reminders-daily',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT secret FROM vault.secrets WHERE name = 'project_url') || '/functions/v1/loan-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret FROM vault.secrets WHERE name = 'service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2nd of every month at 09:00 IST (03:30 UTC) for monthly reports
SELECT cron.schedule(
  'monthly-email-report',
  '30 3 2 * *',
  $$
  SELECT net.http_post(
    url := (SELECT secret FROM vault.secrets WHERE name = 'project_url') || '/functions/v1/monthly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret FROM vault.secrets WHERE name = 'service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
