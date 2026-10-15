-- ============================================================
-- Migration 005: Security hardening, self-healing budget periods,
-- unified spend sync, atomic stack moves, goals, recurring
-- transactions, loan integrity and fixed cron jobs.
--
-- Run AFTER 001–004 in the Supabase SQL Editor (paste the whole file).
-- Safe to re-run: every statement is idempotent.
--
-- What this fixes / adds:
--   * reallocate_stack() let any signed-in user move ANY user's money
--     (it trusted a p_user_id argument). Replaced by move_stack_money(),
--     which only ever acts on auth.uid().
--   * open/close period functions and get_due_loan_reminders() were
--     callable by every API user (cross-tenant writes + email leak).
--     They are now service_role only.
--   * Ledger tables (periods, stacks, stack history) are read-only for
--     clients; all writes go through audited database functions.
--   * Cross-tenant references are blocked (another user's category or
--     loan can no longer be referenced by id).
--   * Transaction edits now keep budgets in sync (UPDATE was ignored),
--     and late edits to closed months rebalance the stack.
--   * Months open/close lazily per user timezone, so the app works even
--     without pg_cron. The old cron closed the month on the 28th.
--   * Cron jobs used vault.secrets (encrypted) instead of
--     vault.decrypted_secrets, so they could never authenticate.
--   * Loan status now follows edits/deletes of repayments.
-- ============================================================

BEGIN;

-- ============ 1. SCHEMA ADDITIONS ============

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_reports_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

ALTER TABLE public.category_periods
  ADD COLUMN IF NOT EXISTS accrued_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '🎯';

ALTER TABLE public.recurring_transactions
  ADD COLUMN IF NOT EXISTS anchor_day int,
  ADD COLUMN IF NOT EXISTS last_posted_date date;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;

ALTER TABLE public.stack_transactions
  ADD COLUMN IF NOT EXISTS related_goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;

-- When the reminder e-mail for a loan last went out (weekly follow-ups)
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS last_reminded_on date;

-- New stack movement types: adjustments for late edits in closed months
ALTER TABLE public.stack_transactions DROP CONSTRAINT IF EXISTS stack_transactions_type_check;
ALTER TABLE public.stack_transactions ADD CONSTRAINT stack_transactions_type_check
  CHECK (type IN ('accrual', 'reallocation_out', 'reallocation_in', 'pulled_to_period',
                  'adjustment_in', 'adjustment_out'));

-- Tighten nullable columns that the budget maths depends on
UPDATE public.category_periods
SET rollover_in = COALESCE(rollover_in, 0),
    spent_amount = COALESCE(spent_amount, 0),
    closed = COALESCE(closed, false)
WHERE rollover_in IS NULL OR spent_amount IS NULL OR closed IS NULL;

ALTER TABLE public.category_periods
  ALTER COLUMN rollover_in SET NOT NULL,
  ALTER COLUMN spent_amount SET NOT NULL,
  ALTER COLUMN closed SET NOT NULL;

UPDATE public.category_stacks SET current_balance = 0 WHERE current_balance IS NULL;
ALTER TABLE public.category_stacks ALTER COLUMN current_balance SET NOT NULL;

UPDATE public.categories
SET is_active = COALESCE(is_active, true), is_flexible = COALESCE(is_flexible, false)
WHERE is_active IS NULL OR is_flexible IS NULL;
ALTER TABLE public.categories
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN is_flexible SET NOT NULL;

UPDATE public.goals SET current_amount = 0 WHERE current_amount IS NULL OR current_amount < 0;
UPDATE public.goals SET color_hex = '#2dd4bf' WHERE color_hex IS NULL;
ALTER TABLE public.goals
  ALTER COLUMN current_amount SET NOT NULL,
  ALTER COLUMN color_hex SET NOT NULL;

UPDATE public.recurring_transactions SET is_active = true WHERE is_active IS NULL;
ALTER TABLE public.recurring_transactions ALTER COLUMN is_active SET NOT NULL;
UPDATE public.recurring_transactions
SET anchor_day = EXTRACT(DAY FROM next_due_date)::int
WHERE anchor_day IS NULL;

UPDATE public.transactions SET source = 'manual' WHERE source IS NULL;
ALTER TABLE public.transactions ALTER COLUMN source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_current_amount_nonneg') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_current_amount_nonneg CHECK (current_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_anchor_day_range') THEN
    ALTER TABLE public.recurring_transactions
      ADD CONSTRAINT recurring_anchor_day_range CHECK (anchor_day IS NULL OR anchor_day BETWEEN 1 AND 31);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_budget_nonneg') THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_budget_nonneg CHECK (monthly_budget_amount >= 0) NOT VALID;
  END IF;
END $$;

-- Sort order for categories: keep the order they were created in
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, name) AS rn
  FROM public.categories
)
UPDATE public.categories c SET sort_order = o.rn
FROM ordered o
WHERE o.id = c.id AND c.sort_order = 0;

-- Anyone who already has categories has been through onboarding
UPDATE public.profiles p SET onboarded_at = now()
WHERE p.onboarded_at IS NULL
  AND EXISTS (SELECT 1 FROM public.categories c WHERE c.user_id = p.id);

-- ============ 2. INDEXES ============

CREATE INDEX IF NOT EXISTS idx_categories_user_active ON public.categories(user_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_group ON public.categories(group_id);
CREATE INDEX IF NOT EXISTS idx_category_groups_user ON public.category_groups(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_category_periods_open ON public.category_periods(user_id, closed, year, month);
CREATE INDEX IF NOT EXISTS idx_recurring_due ON public.recurring_transactions(user_id, is_active, next_due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_category ON public.recurring_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON public.goals(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_purchases_user_date ON public.stock_purchases(user_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_user ON public.loan_repayments(user_id);
CREATE INDEX IF NOT EXISTS idx_stack_txn_related_category ON public.stack_transactions(related_category_id);
CREATE INDEX IF NOT EXISTS idx_stack_txn_stock ON public.stack_transactions(related_stock_purchase_id);
CREATE INDEX IF NOT EXISTS idx_stack_txn_goal ON public.stack_transactions(related_goal_id);
CREATE INDEX IF NOT EXISTS idx_email_reports_log_lookup ON public.email_reports_log(user_id, report_type, year, month);

-- A recurring rule can post at most once per due date (makes posting idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_recurring_occurrence
  ON public.transactions(recurring_id, txn_date) WHERE recurring_id IS NOT NULL;

-- One monthly report per user per month (dedupe any accidental doubles first)
DELETE FROM public.email_reports_log a
USING public.email_reports_log b
WHERE a.report_type = 'monthly' AND b.report_type = 'monthly'
  AND a.user_id = b.user_id
  AND a.year IS NOT DISTINCT FROM b.year AND a.month IS NOT DISTINCT FROM b.month
  AND a.id > b.id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_reports_monthly
  ON public.email_reports_log(user_id, year, month) WHERE report_type = 'monthly';

-- ============ 3. TIME HELPERS ============

-- The user's IANA timezone (falls back to Asia/Kolkata when missing/invalid)
CREATE OR REPLACE FUNCTION public.app_timezone(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tz text;
BEGIN
  SELECT NULLIF(btrim(timezone), '') INTO v_tz FROM public.profiles WHERE id = p_user_id;
  IF v_tz IS NULL THEN
    RETURN 'Asia/Kolkata';
  END IF;
  PERFORM (now() AT TIME ZONE v_tz);
  RETURN v_tz;
EXCEPTION WHEN OTHERS THEN
  RETURN 'Asia/Kolkata';
END;
$$;

-- "Today" as the user sees it on their wall calendar
CREATE OR REPLACE FUNCTION public.app_today(p_user_id uuid)
RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE public.app_timezone(p_user_id))::date;
$$;

-- Next occurrence for a recurring rule; monthly/yearly rules stick to their
-- anchor day and clamp to the month's last day (31st -> 30th/28th, no drift)
CREATE OR REPLACE FUNCTION public.next_recurring_date(p_from date, p_frequency text, p_anchor_day int)
RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  v_month_start date;
  v_last_day int;
BEGIN
  IF p_frequency = 'daily' THEN
    RETURN p_from + 1;
  ELSIF p_frequency = 'weekly' THEN
    RETURN p_from + 7;
  ELSIF p_frequency = 'monthly' THEN
    v_month_start := (date_trunc('month', p_from::timestamp) + interval '1 month')::date;
  ELSIF p_frequency = 'yearly' THEN
    v_month_start := (date_trunc('month', p_from::timestamp) + interval '1 year')::date;
  ELSE
    RAISE EXCEPTION 'Unknown frequency: %', p_frequency;
  END IF;
  v_last_day := EXTRACT(DAY FROM (v_month_start::timestamp + interval '1 month' - interval '1 day'))::int;
  RETURN v_month_start + (LEAST(COALESCE(p_anchor_day, EXTRACT(DAY FROM p_from)::int), v_last_day) - 1);
END;
$$;

-- ============ 4. BUDGET ENGINE ============

-- A closed period has already rolled its leftover into the stack
-- (tracked in accrued_amount). When its spending changes later, move the
-- stack by the difference. Clawbacks never push a stack below zero.
CREATE OR REPLACE FUNCTION public.rebalance_closed_period(p_period_id uuid, p_comment text)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p public.category_periods%ROWTYPE;
  v_target numeric;
  v_diff numeric;
  v_balance numeric;
  v_applied numeric;
BEGIN
  SELECT * INTO v_p FROM public.category_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND OR NOT v_p.closed THEN
    RETURN 0;
  END IF;

  v_target := GREATEST(0, v_p.budgeted_amount + v_p.rollover_in - v_p.spent_amount);
  v_diff := v_target - v_p.accrued_amount;
  IF v_diff = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.category_stacks (user_id, category_id, current_balance)
  VALUES (v_p.user_id, v_p.category_id, 0)
  ON CONFLICT (user_id, category_id) DO NOTHING;

  SELECT current_balance INTO v_balance
  FROM public.category_stacks
  WHERE user_id = v_p.user_id AND category_id = v_p.category_id
  FOR UPDATE;

  v_applied := CASE WHEN v_diff > 0 THEN v_diff ELSE -LEAST(-v_diff, GREATEST(v_balance, 0)) END;
  IF v_applied = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.category_stacks
  SET current_balance = current_balance + v_applied, last_updated = now()
  WHERE user_id = v_p.user_id AND category_id = v_p.category_id;

  UPDATE public.category_periods SET accrued_amount = accrued_amount + v_applied WHERE id = v_p.id;

  INSERT INTO public.stack_transactions (user_id, category_id, type, amount, month, year, comment)
  VALUES (v_p.user_id, v_p.category_id,
          CASE WHEN v_applied > 0 THEN 'adjustment_in' ELSE 'adjustment_out' END,
          abs(v_applied), v_p.month, v_p.year, p_comment);

  RETURN v_applied;
END;
$$;

-- Apply a change in spending to the right (user, category, month) period.
-- Back-dated spend in a month that was never budgeted is recorded as a
-- closed zero-budget period, so it can never accrue phantom stack money.
CREATE OR REPLACE FUNCTION public.apply_period_spend_delta(
  p_user_id uuid, p_category_id uuid, p_txn_date date, p_delta numeric
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_month int := EXTRACT(MONTH FROM p_txn_date)::int;
  v_year int := EXTRACT(YEAR FROM p_txn_date)::int;
  v_budget numeric;
  v_active boolean;
  v_is_past boolean;
  v_period_id uuid;
  v_closed boolean;
BEGIN
  IF p_category_id IS NULL OR p_delta IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  SELECT monthly_budget_amount, is_active INTO v_budget, v_active
  FROM public.categories
  WHERE id = p_category_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_is_past := make_date(v_year, v_month, 1) < date_trunc('month', public.app_today(p_user_id))::date;

  INSERT INTO public.category_periods AS cp
    (user_id, category_id, month, year, budgeted_amount, spent_amount, closed, closed_at)
  VALUES
    (p_user_id, p_category_id, v_month, v_year,
     CASE WHEN v_is_past OR NOT v_active THEN 0 ELSE v_budget END,
     GREATEST(p_delta, 0), v_is_past, CASE WHEN v_is_past THEN now() END)
  ON CONFLICT (user_id, category_id, month, year)
  DO UPDATE SET spent_amount = GREATEST(0, cp.spent_amount + p_delta)
  RETURNING id, closed INTO v_period_id, v_closed;

  INSERT INTO public.category_stacks (user_id, category_id, current_balance)
  VALUES (p_user_id, p_category_id, 0)
  ON CONFLICT (user_id, category_id) DO NOTHING;

  IF v_closed THEN
    PERFORM public.rebalance_closed_period(v_period_id, 'Auto-adjustment: a transaction changed in a closed month');
  END IF;
END;
$$;

-- One trigger for INSERT / UPDATE / DELETE (edits used to be ignored)
CREATE OR REPLACE FUNCTION public.sync_period_spent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_period_spend_delta(NEW.user_id, NEW.category_id, NEW.txn_date, NEW.amount);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.apply_period_spend_delta(OLD.user_id, OLD.category_id, OLD.txn_date, -OLD.amount);
    RETURN OLD;
  END IF;

  IF NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.txn_date IS DISTINCT FROM OLD.txn_date
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    PERFORM public.apply_period_spend_delta(OLD.user_id, OLD.category_id, OLD.txn_date, -OLD.amount);
    PERFORM public.apply_period_spend_delta(NEW.user_id, NEW.category_id, NEW.txn_date, NEW.amount);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_insert_sync_period ON public.transactions;
DROP TRIGGER IF EXISTS trg_transaction_delete_sync_period ON public.transactions;
DROP TRIGGER IF EXISTS trg_transactions_sync_period ON public.transactions;
CREATE TRIGGER trg_transactions_sync_period
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_period_spent();

DROP FUNCTION IF EXISTS public.sync_period_spent_on_insert();
DROP FUNCTION IF EXISTS public.sync_period_spent_on_delete();

-- Block references to another user's category (FKs only check existence)
CREATE OR REPLACE FUNCTION public.validate_category_owner()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR NEW.category_id IS DISTINCT FROM OLD.category_id
          OR NEW.user_id IS DISTINCT FROM OLD.user_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.categories c WHERE c.id = NEW.category_id AND c.user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'Category not found' USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_validate_category ON public.transactions;
CREATE TRIGGER trg_transactions_validate_category
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_category_owner();

DROP TRIGGER IF EXISTS trg_recurring_validate_category ON public.recurring_transactions;
CREATE TRIGGER trg_recurring_validate_category
  BEFORE INSERT OR UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_category_owner();

-- Recurring rules remember the day of month they were created for
CREATE OR REPLACE FUNCTION public.prepare_recurring()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.anchor_day IS NULL THEN
    NEW.anchor_day := EXTRACT(DAY FROM NEW.next_due_date)::int;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recurring_prepare ON public.recurring_transactions;
CREATE TRIGGER trg_recurring_prepare
  BEFORE INSERT OR UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prepare_recurring();

-- Categories: same-owner groups/parents, max one level of sub-categories
CREATE OR REPLACE FUNCTION public.validate_category()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.name IS DISTINCT FROM OLD.name THEN
    NEW.name := btrim(NEW.name);
    IF NEW.name = '' THEN
      RAISE EXCEPTION 'Category name is required';
    END IF;
  END IF;

  IF NEW.group_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.group_id IS DISTINCT FROM OLD.group_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.category_groups g WHERE g.id = NEW.group_id AND g.user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'Category group not found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.parent_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'A category cannot be its own parent';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.categories p
      WHERE p.id = NEW.parent_id AND p.user_id = NEW.user_id AND p.parent_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Parent category not found (sub-categories are one level deep)'
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.categories ch WHERE ch.parent_id = NEW.id) THEN
      RAISE EXCEPTION 'This category has sub-categories, so it cannot become a sub-category';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_validate ON public.categories;
CREATE TRIGGER trg_categories_validate
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_category();

-- Keep the live month in step with category changes:
--  * new category      -> stack + this month's period
--  * budget edited     -> this month's open period uses the new budget
--  * removed           -> unspent budget is released (no month-end accrual),
--                         sub-categories and recurring rules are paused
--  * restored          -> this month's period is (re)opened
CREATE OR REPLACE FUNCTION public.on_category_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := public.app_today(NEW.user_id);
  v_month int := EXTRACT(MONTH FROM v_today)::int;
  v_year int := EXTRACT(YEAR FROM v_today)::int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.category_stacks (user_id, category_id, current_balance)
    VALUES (NEW.user_id, NEW.id, 0)
    ON CONFLICT (user_id, category_id) DO NOTHING;
  END IF;

  IF NEW.is_active
     AND (TG_OP = 'INSERT' OR NOT OLD.is_active
          OR NEW.monthly_budget_amount IS DISTINCT FROM OLD.monthly_budget_amount) THEN
    INSERT INTO public.category_periods AS cp (user_id, category_id, month, year, budgeted_amount)
    VALUES (NEW.user_id, NEW.id, v_month, v_year, NEW.monthly_budget_amount)
    ON CONFLICT (user_id, category_id, month, year)
    DO UPDATE SET budgeted_amount = EXCLUDED.budgeted_amount
    WHERE cp.closed = false;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active AND NOT NEW.is_active THEN
    UPDATE public.category_periods
    SET budgeted_amount = LEAST(budgeted_amount, spent_amount)
    WHERE user_id = NEW.user_id AND category_id = NEW.id AND closed = false;

    UPDATE public.recurring_transactions
    SET is_active = false
    WHERE user_id = NEW.user_id AND category_id = NEW.id AND is_active;

    UPDATE public.categories
    SET is_active = false
    WHERE user_id = NEW.user_id AND parent_id = NEW.id AND is_active;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_sync_period ON public.categories;
CREATE TRIGGER trg_categories_sync_period
  AFTER INSERT OR UPDATE OF monthly_budget_amount, is_active ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.on_category_change();

-- ============ 5. MONTH LIFECYCLE (lazy + cron) ============

-- Close every open period that started before p_before and accrue its
-- unused budget into the category stack.
CREATE OR REPLACE FUNCTION public.close_user_periods(p_user_id uuid, p_before date)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period record;
  v_unused numeric;
  v_count int := 0;
BEGIN
  FOR v_period IN
    SELECT id, category_id, month, year, budgeted_amount, rollover_in, spent_amount
    FROM public.category_periods
    WHERE user_id = p_user_id AND closed = false AND make_date(year, month, 1) < p_before
    ORDER BY year, month
    FOR UPDATE
  LOOP
    v_unused := GREATEST(0, v_period.budgeted_amount + v_period.rollover_in - v_period.spent_amount);

    IF v_unused > 0 THEN
      INSERT INTO public.category_stacks AS cs (user_id, category_id, current_balance, last_updated)
      VALUES (p_user_id, v_period.category_id, v_unused, now())
      ON CONFLICT (user_id, category_id)
      DO UPDATE SET current_balance = cs.current_balance + EXCLUDED.current_balance, last_updated = now();

      INSERT INTO public.stack_transactions (user_id, category_id, type, amount, month, year, comment)
      VALUES (p_user_id, v_period.category_id, 'accrual', v_unused, v_period.month, v_period.year,
              'Month-end rollover: unused budget accrued to stack');
    END IF;

    UPDATE public.category_periods
    SET closed = true, closed_at = now(), accrued_amount = v_unused
    WHERE id = v_period.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Open a month for every active category. When back-filling a skipped
-- month, only categories that already existed in that month are opened.
CREATE OR REPLACE FUNCTION public.open_user_periods(
  p_user_id uuid, p_month int, p_year int, p_only_existing boolean DEFAULT false
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int;
  v_next_month timestamptz := (make_date(p_year, p_month, 1) + interval '1 month')::timestamp
                              AT TIME ZONE public.app_timezone(p_user_id);
BEGIN
  INSERT INTO public.category_periods (user_id, category_id, month, year, budgeted_amount)
  SELECT c.user_id, c.id, p_month, p_year, c.monthly_budget_amount
  FROM public.categories c
  WHERE c.user_id = p_user_id
    AND c.is_active
    AND (NOT p_only_existing OR c.created_at < v_next_month)
  ON CONFLICT (user_id, category_id, month, year) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.category_stacks (user_id, category_id, current_balance)
  SELECT c.user_id, c.id, 0 FROM public.categories c WHERE c.user_id = p_user_id
  ON CONFLICT (user_id, category_id) DO NOTHING;

  RETURN v_count;
END;
$$;

-- Post every recurring transaction that has come due (catches up missed
-- occurrences). Rules for removed categories are skipped.
CREATE OR REPLACE FUNCTION public.post_due_recurring(p_user_id uuid, p_today date)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rule record;
  v_due date;
  v_last date;
  v_iter int;
  v_count int := 0;
BEGIN
  FOR v_rule IN
    SELECT r.id, r.category_id, r.amount, r.description, r.frequency, r.next_due_date, r.anchor_day
    FROM public.recurring_transactions r
    LEFT JOIN public.categories c ON c.id = r.category_id
    WHERE r.user_id = p_user_id
      AND r.is_active
      AND r.next_due_date <= p_today
      AND (r.category_id IS NULL OR c.is_active)
    ORDER BY r.next_due_date
    FOR UPDATE OF r
  LOOP
    v_due := v_rule.next_due_date;
    v_last := NULL;
    v_iter := 0;
    WHILE v_due <= p_today AND v_iter < 400 LOOP
      INSERT INTO public.transactions (user_id, category_id, amount, description, txn_date, source, recurring_id)
      VALUES (p_user_id, v_rule.category_id, v_rule.amount, v_rule.description, v_due, 'recurring', v_rule.id)
      ON CONFLICT (recurring_id, txn_date) WHERE recurring_id IS NOT NULL DO NOTHING;
      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
      v_last := v_due;
      v_due := public.next_recurring_date(v_due, v_rule.frequency, v_rule.anchor_day);
      v_iter := v_iter + 1;
    END LOOP;

    UPDATE public.recurring_transactions
    SET next_due_date = v_due, last_posted_date = COALESCE(v_last, last_posted_date)
    WHERE id = v_rule.id;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Bring one user's budget months up to date. Called lazily by the app on
-- page load (sync_my_periods) and hourly by cron (sync_all_periods).
CREATE OR REPLACE FUNCTION public.sync_user_periods(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date;
  v_start date;
  v_cursor date;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Serialise concurrent syncs for the same user (no row write needed)
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger-sync:' || p_user_id::text, 0));

  v_today := public.app_today(p_user_id);
  v_start := date_trunc('month', v_today)::date;

  -- 1. Back-fill months that were skipped entirely (bounded to 12)
  SELECT (max(make_date(year, month, 1)) + interval '1 month')::date INTO v_cursor
  FROM public.category_periods
  WHERE user_id = p_user_id AND make_date(year, month, 1) < v_start;

  IF v_cursor IS NOT NULL THEN
    v_cursor := GREATEST(v_cursor, (v_start - interval '12 months')::date);
    WHILE v_cursor < v_start LOOP
      PERFORM public.open_user_periods(
        p_user_id, EXTRACT(MONTH FROM v_cursor)::int, EXTRACT(YEAR FROM v_cursor)::int, true);
      v_cursor := (v_cursor + interval '1 month')::date;
    END LOOP;
  END IF;

  -- 2. Recurring transactions land in their month before it closes
  PERFORM public.post_due_recurring(p_user_id, v_today);

  -- 3. Close finished months, 4. open the current one
  PERFORM public.close_user_periods(p_user_id, v_start);
  PERFORM public.open_user_periods(
    p_user_id, EXTRACT(MONTH FROM v_today)::int, EXTRACT(YEAR FROM v_today)::int, false);
END;
$$;

-- Client entry point: only ever syncs the caller
CREATE OR REPLACE FUNCTION public.sync_my_periods()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM public.sync_user_periods(v_uid);
END;
$$;

-- Cron / service entry point: every user, failures isolated per user
CREATE OR REPLACE FUNCTION public.sync_all_periods()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_count int := 0;
BEGIN
  FOR v_user IN
    SELECT user_id FROM public.categories
    UNION
    SELECT user_id FROM public.recurring_transactions
  LOOP
    BEGIN
      PERFORM public.sync_user_periods(v_user);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sync_user_periods(%) failed: %', v_user, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Legacy names (old Edge Functions / cron call these). They now run the
-- safe per-user-timezone sync and can no longer close the current month.
CREATE OR REPLACE FUNCTION public.open_new_periods(p_month int DEFAULT NULL, p_year int DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_all_periods();
END;
$$;

CREATE OR REPLACE FUNCTION public.close_periods_and_accrue_stacks(p_month int DEFAULT NULL, p_year int DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_all_periods();
END;
$$;

-- The insecure reallocation entry point is removed (see move_stack_money)
DROP FUNCTION IF EXISTS public.reallocate_stack(uuid, jsonb, text, uuid, int, int, uuid, text);

-- ============ 6. STACK MOVEMENTS (atomic, caller-scoped) ============

-- Move money out of one or more stacks into: this month's budget of a
-- category ('period'), another stack ('stack'), a stock purchase ('stock')
-- or a savings goal ('goal'). Everything happens in one transaction.
CREATE OR REPLACE FUNCTION public.move_stack_money(
  p_sources jsonb,
  p_dest_type text,
  p_dest_category_id uuid DEFAULT NULL,
  p_dest_goal_id uuid DEFAULT NULL,
  p_ticker_or_note text DEFAULT NULL,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_comment text := NULLIF(btrim(p_comment), '');
  v_note text := NULLIF(btrim(p_ticker_or_note), '');
  v_today date;
  v_month int;
  v_year int;
  v_item jsonb;
  v_src_id uuid;
  v_amount numeric;
  v_balance numeric;
  v_src_name text;
  v_dest_name text;
  v_total numeric := 0;
  v_funded jsonb := '[]'::jsonb;
  v_stock_id uuid;
  v_period_id uuid;
  v_out_type text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_comment IS NULL THEN
    RAISE EXCEPTION 'A comment is required for every stack movement';
  END IF;
  IF length(v_comment) > 500 THEN
    RAISE EXCEPTION 'Comment is too long (500 characters max)';
  END IF;
  IF p_dest_type IS NULL OR p_dest_type NOT IN ('period', 'stack', 'stock', 'goal') THEN
    RAISE EXCEPTION 'Invalid destination';
  END IF;
  IF p_sources IS NULL OR jsonb_typeof(p_sources) <> 'array' OR jsonb_array_length(p_sources) = 0 THEN
    RAISE EXCEPTION 'Select at least one source stack';
  END IF;
  IF jsonb_array_length(p_sources) > 50 THEN
    RAISE EXCEPTION 'Too many source stacks';
  END IF;

  v_today := public.app_today(v_user);
  v_month := EXTRACT(MONTH FROM v_today)::int;
  v_year := EXTRACT(YEAR FROM v_today)::int;

  IF p_dest_type IN ('period', 'stack') THEN
    SELECT name INTO v_dest_name FROM public.categories
    WHERE id = p_dest_category_id AND user_id = v_user AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Destination category not found';
    END IF;
  ELSIF p_dest_type = 'goal' THEN
    SELECT name INTO v_dest_name FROM public.goals
    WHERE id = p_dest_goal_id AND user_id = v_user
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Goal not found';
    END IF;
  ELSIF v_note IS NULL THEN
    RAISE EXCEPTION 'Enter a stock name or ticker';
  ELSE
    v_dest_name := left(v_note, 200);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_sources) LOOP
    BEGIN
      v_src_id := (v_item->>'category_id')::uuid;
      v_amount := round((v_item->>'amount')::numeric, 2);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid source entry';
    END;

    IF v_src_id IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Each source needs a positive amount';
    END IF;
    IF p_dest_type = 'stack' AND v_src_id = p_dest_category_id THEN
      RAISE EXCEPTION 'Source and destination stacks must be different';
    END IF;

    SELECT s.current_balance, c.name INTO v_balance, v_src_name
    FROM public.category_stacks s
    JOIN public.categories c ON c.id = s.category_id
    WHERE s.user_id = v_user AND s.category_id = v_src_id
    FOR UPDATE OF s;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Source stack not found';
    END IF;
    IF v_balance < v_amount THEN
      RAISE EXCEPTION 'Insufficient balance in the % stack (available: %)', v_src_name, v_balance;
    END IF;

    UPDATE public.category_stacks
    SET current_balance = current_balance - v_amount, last_updated = now()
    WHERE user_id = v_user AND category_id = v_src_id;

    v_total := v_total + v_amount;
    v_funded := v_funded || jsonb_build_array(
      jsonb_build_object('category_id', v_src_id, 'category', v_src_name, 'amount', v_amount));
  END LOOP;

  IF p_dest_type = 'stock' THEN
    INSERT INTO public.stock_purchases (user_id, amount, purchase_date, ticker_or_note, funded_from)
    VALUES (v_user, v_total, v_today, left(v_note, 200), v_funded)
    RETURNING id INTO v_stock_id;
  ELSIF p_dest_type = 'goal' THEN
    UPDATE public.goals SET current_amount = current_amount + v_total WHERE id = p_dest_goal_id;
  ELSIF p_dest_type = 'stack' THEN
    INSERT INTO public.category_stacks AS cs (user_id, category_id, current_balance, last_updated)
    VALUES (v_user, p_dest_category_id, v_total, now())
    ON CONFLICT (user_id, category_id)
    DO UPDATE SET current_balance = cs.current_balance + EXCLUDED.current_balance, last_updated = now();

    INSERT INTO public.stack_transactions (user_id, category_id, type, amount, comment, month, year)
    VALUES (v_user, p_dest_category_id, 'reallocation_in', v_total, v_comment, v_month, v_year);
  ELSE
    INSERT INTO public.category_periods (user_id, category_id, month, year, budgeted_amount)
    SELECT v_user, c.id, v_month, v_year, c.monthly_budget_amount
    FROM public.categories c WHERE c.id = p_dest_category_id
    ON CONFLICT (user_id, category_id, month, year) DO NOTHING;

    UPDATE public.category_periods
    SET rollover_in = rollover_in + v_total
    WHERE user_id = v_user AND category_id = p_dest_category_id
      AND month = v_month AND year = v_year AND closed = false
    RETURNING id INTO v_period_id;
    IF v_period_id IS NULL THEN
      RAISE EXCEPTION 'This month''s budget for % is already closed', v_dest_name;
    END IF;
  END IF;

  -- Audit trail: one row per source stack
  v_out_type := CASE WHEN p_dest_type = 'period' THEN 'pulled_to_period' ELSE 'reallocation_out' END;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_funded) LOOP
    INSERT INTO public.stack_transactions (
      user_id, category_id, type, amount, related_category_id,
      related_stock_purchase_id, related_goal_id, comment, month, year
    ) VALUES (
      v_user, (v_item->>'category_id')::uuid, v_out_type, (v_item->>'amount')::numeric,
      CASE WHEN p_dest_type IN ('period', 'stack') THEN p_dest_category_id END,
      v_stock_id,
      CASE WHEN p_dest_type = 'goal' THEN p_dest_goal_id END,
      v_comment, v_month, v_year
    );
  END LOOP;

  RETURN jsonb_build_object('total', v_total, 'stock_purchase_id', v_stock_id, 'destination', v_dest_name);
END;
$$;

-- ============ 7. GOALS ============

-- Atomic manual contribution / withdrawal (RLS applies: invoker rights)
CREATE OR REPLACE FUNCTION public.adjust_goal_amount(p_goal_id uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_new numeric;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 OR abs(p_delta) > 100000000 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  UPDATE public.goals
  SET current_amount = GREATEST(0, current_amount + round(p_delta, 2))
  WHERE id = p_goal_id AND user_id = auth.uid()
  RETURNING current_amount INTO v_new;
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'Goal not found';
  END IF;
  RETURN v_new;
END;
$$;

-- ============ 8. LOANS ============

-- Repayments must belong to the caller's own loan and never exceed it.
-- Locking the loan row serialises concurrent repayments.
CREATE OR REPLACE FUNCTION public.validate_loan_repayment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_amount numeric;
  v_owner uuid;
  v_repaid numeric;
BEGIN
  SELECT amount, user_id INTO v_amount, v_owner FROM public.loans WHERE id = NEW.loan_id FOR UPDATE;
  IF NOT FOUND OR v_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Loan not found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_repaid
  FROM public.loan_repayments
  WHERE loan_id = NEW.loan_id AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_repaid + NEW.amount > v_amount + 0.01 THEN
    RAISE EXCEPTION 'Repayment exceeds the outstanding balance of %', round(v_amount - v_repaid, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_repayments_validate ON public.loan_repayments;
CREATE TRIGGER trg_loan_repayments_validate
  BEFORE INSERT OR UPDATE ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.validate_loan_repayment();

CREATE OR REPLACE FUNCTION public.recompute_loan_status(p_loan_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_amount numeric;
  v_repaid numeric;
  v_status text;
BEGIN
  SELECT amount INTO v_amount FROM public.loans WHERE id = p_loan_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_repaid FROM public.loan_repayments WHERE loan_id = p_loan_id;
  v_status := CASE
    WHEN v_repaid >= v_amount THEN 'repaid'
    WHEN v_repaid > 0 THEN 'partially_repaid'
    ELSE 'outstanding'
  END;
  UPDATE public.loans SET status = v_status WHERE id = p_loan_id AND status IS DISTINCT FROM v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_loan_repayment_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.recompute_loan_status(NEW.loan_id);
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.loan_id IS DISTINCT FROM NEW.loan_id) THEN
    PERFORM public.recompute_loan_status(OLD.loan_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_repayment_sync_status ON public.loan_repayments;
DROP TRIGGER IF EXISTS trg_loan_repayments_status ON public.loan_repayments;
CREATE TRIGGER trg_loan_repayments_status
  AFTER INSERT OR UPDATE OR DELETE ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.on_loan_repayment_change();
DROP FUNCTION IF EXISTS public.sync_loan_status();

CREATE OR REPLACE FUNCTION public.on_loan_amount_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_loan_status(NEW.id);
  RETURN NULL;
END;
$$;

-- A loan's amount can never drop below what has already been repaid
CREATE OR REPLACE FUNCTION public.validate_loan_amount()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_repaid numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_repaid FROM public.loan_repayments WHERE loan_id = NEW.id;
  IF NEW.amount + 0.01 < v_repaid THEN
    RAISE EXCEPTION 'The amount cannot be less than what has already been repaid (%)', round(v_repaid, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loans_validate_amount ON public.loans;
CREATE TRIGGER trg_loans_validate_amount
  BEFORE UPDATE OF amount ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.validate_loan_amount();

-- Moving the reminder date (snooze) re-arms the reminder e-mail
CREATE OR REPLACE FUNCTION public.reset_loan_reminder()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.reminder_date IS DISTINCT FROM OLD.reminder_date THEN
    NEW.last_reminded_on := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loans_reset_reminder ON public.loans;
CREATE TRIGGER trg_loans_reset_reminder
  BEFORE UPDATE OF reminder_date ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.reset_loan_reminder();

-- Called by the loan-reminders Edge Function after a successful send
CREATE OR REPLACE FUNCTION public.mark_loans_reminded(p_loan_ids uuid[])
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.loans l
  SET last_reminded_on = public.app_today(l.user_id)
  WHERE l.id = ANY (p_loan_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DROP TRIGGER IF EXISTS trg_loans_amount_status ON public.loans;
CREATE TRIGGER trg_loans_amount_status
  AFTER UPDATE OF amount ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.on_loan_amount_change();

-- ============ 9. REPORTING ============

-- Budget vs. actual per month for the caller (RLS applies)
CREATE OR REPLACE FUNCTION public.monthly_trend(p_from date, p_to date)
RETURNS TABLE (month_start date, budgeted numeric, spent numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH bounds AS (
    SELECT date_trunc('month', p_from::timestamp)::date AS lo,
           date_trunc('month', p_to::timestamp)::date AS hi
  ),
  months AS (
    SELECT d::date AS m
    FROM bounds, generate_series(bounds.lo::timestamp, bounds.hi::timestamp, interval '1 month') AS d
    LIMIT 36
  ),
  b AS (
    SELECT make_date(cp.year, cp.month, 1) AS m, SUM(cp.budgeted_amount + cp.rollover_in) AS budgeted
    FROM public.category_periods cp, bounds
    WHERE cp.user_id = (SELECT auth.uid())
      AND make_date(cp.year, cp.month, 1) BETWEEN bounds.lo AND bounds.hi
    GROUP BY 1
  ),
  s AS (
    SELECT date_trunc('month', t.txn_date::timestamp)::date AS m, SUM(t.amount) AS spent
    FROM public.transactions t, bounds
    WHERE t.user_id = (SELECT auth.uid())
      AND t.txn_date >= bounds.lo
      AND t.txn_date < (bounds.hi + interval '1 month')::date
    GROUP BY 1
  )
  SELECT months.m, COALESCE(b.budgeted, 0), COALESCE(s.spent, 0)
  FROM months
  LEFT JOIN b ON b.m = months.m
  LEFT JOIN s ON s.m = months.m
  ORDER BY months.m;
$$;

-- Loan reminders that are due today or overdue, with what is still owed.
-- Service role only (it reads auth.users emails).
DROP FUNCTION IF EXISTS public.get_due_loan_reminders();
CREATE FUNCTION public.get_due_loan_reminders()
RETURNS TABLE (
  loan_id uuid,
  user_id uuid,
  borrower_name text,
  direction text,
  amount numeric,
  outstanding numeric,
  date_lent date,
  reason text,
  reminder_date date,
  days_overdue int,
  user_email text,
  display_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    l.id,
    l.user_id,
    l.borrower_name,
    l.direction,
    l.amount,
    l.amount - COALESCE((SELECT SUM(r.amount) FROM public.loan_repayments r WHERE r.loan_id = l.id), 0),
    l.date_lent,
    l.reason,
    l.reminder_date,
    (public.app_today(l.user_id) - l.reminder_date)::int,
    au.email::text,
    p.display_name
  FROM public.loans l
  JOIN auth.users au ON au.id = l.user_id
  LEFT JOIN public.profiles p ON p.id = l.user_id
  WHERE l.status <> 'repaid'
    AND l.reminder_date IS NOT NULL
    AND l.reminder_date <= public.app_today(l.user_id)
    -- First reminder on (or after) the date, then weekly until settled or snoozed
    AND (l.last_reminded_on IS NULL OR l.last_reminded_on <= public.app_today(l.user_id) - 7)
    AND au.email IS NOT NULL;
$$;

-- Who should receive the monthly report (auth email, not the editable profile copy)
CREATE OR REPLACE FUNCTION public.get_report_recipients()
RETURNS TABLE (user_id uuid, email text, display_name text, monthly_income numeric, timezone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT au.id, au.email::text, p.display_name, COALESCE(p.monthly_income, 0), public.app_timezone(au.id)
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE au.email IS NOT NULL
    AND au.email_confirmed_at IS NOT NULL
    AND p.email_reports_enabled;
$$;

-- ============ 10. AUTH HOOK ============

-- New users start with zero income (onboarding asks for it) instead of 45000
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, monthly_income)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''), split_part(NEW.email, '@', 1)),
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ============ 11. ROW LEVEL SECURITY ============
-- Ledger tables (periods, stacks, stack history, stock purchases) are
-- written only by the functions above; clients get read access.

DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "category_groups_own" ON public.category_groups;
CREATE POLICY "category_groups_own" ON public.category_groups FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Categories are archived (is_active = false), never hard-deleted by clients:
-- a hard delete would cascade away stack money and history.
DROP POLICY IF EXISTS "categories_own" ON public.categories;
DROP POLICY IF EXISTS "categories_select_own" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_own" ON public.categories;
DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
CREATE POLICY "categories_select_own" ON public.categories FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "categories_insert_own" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "categories_update_own" ON public.categories FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "transactions_own" ON public.transactions;
CREATE POLICY "transactions_own" ON public.transactions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "recurring_transactions_own" ON public.recurring_transactions;
CREATE POLICY "recurring_transactions_own" ON public.recurring_transactions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "goals_own" ON public.goals;
CREATE POLICY "goals_own" ON public.goals FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "loans_own" ON public.loans;
CREATE POLICY "loans_own" ON public.loans FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "loan_repayments_own" ON public.loan_repayments;
CREATE POLICY "loan_repayments_own" ON public.loan_repayments FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "email_reports_log_own" ON public.email_reports_log;
DROP POLICY IF EXISTS "email_reports_log_select_own" ON public.email_reports_log;
CREATE POLICY "email_reports_log_select_own" ON public.email_reports_log FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "category_periods_own" ON public.category_periods;
DROP POLICY IF EXISTS "category_periods_select_own" ON public.category_periods;
CREATE POLICY "category_periods_select_own" ON public.category_periods FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "category_stacks_own" ON public.category_stacks;
DROP POLICY IF EXISTS "category_stacks_select_own" ON public.category_stacks;
CREATE POLICY "category_stacks_select_own" ON public.category_stacks FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "stack_transactions_own" ON public.stack_transactions;
DROP POLICY IF EXISTS "stack_transactions_select_own" ON public.stack_transactions;
CREATE POLICY "stack_transactions_select_own" ON public.stack_transactions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Stock purchases: read + edit the note; created only via move_stack_money
DROP POLICY IF EXISTS "stock_purchases_own" ON public.stock_purchases;
DROP POLICY IF EXISTS "stock_purchases_select_own" ON public.stock_purchases;
DROP POLICY IF EXISTS "stock_purchases_update_own" ON public.stock_purchases;
CREATE POLICY "stock_purchases_select_own" ON public.stock_purchases FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "stock_purchases_update_own" ON public.stock_purchases FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Only the note of a stock purchase is editable by its owner
REVOKE UPDATE ON public.stock_purchases FROM authenticated, anon;
GRANT UPDATE (ticker_or_note) ON public.stock_purchases TO authenticated;

-- ============ 12. FUNCTION PRIVILEGES ============
-- Supabase grants EXECUTE on new public functions to anon + authenticated
-- by default, so internal helpers must be revoked explicitly.

REVOKE ALL ON FUNCTION public.app_timezone(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_today(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_recurring_date(date, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebalance_closed_period(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_period_spend_delta(uuid, uuid, date, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_user_periods(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_user_periods(uuid, int, int, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_due_recurring(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_user_periods(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_loan_status(uuid) FROM PUBLIC, anon, authenticated;

-- Trigger functions
REVOKE ALL ON FUNCTION public.sync_period_spent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_category_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_recurring() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_category() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_category_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_loan_repayment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_loan_repayment_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_loan_amount_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_loan_amount() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_loan_reminder() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Service-only (cron, Edge Functions with the secret key)
REVOKE ALL ON FUNCTION public.sync_all_periods() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_new_periods(int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_periods_and_accrue_stacks(int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_due_loan_reminders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_report_recipients() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_loans_reminded(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_loans_reminded(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_all_periods() TO service_role;
GRANT EXECUTE ON FUNCTION public.open_new_periods(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_periods_and_accrue_stacks(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_due_loan_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_report_recipients() TO service_role;

-- Client RPCs (each one acts on auth.uid() only)
REVOKE ALL ON FUNCTION public.sync_my_periods() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.move_stack_money(jsonb, text, uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_goal_amount(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.monthly_trend(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_periods() TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_stack_money(jsonb, text, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_goal_amount(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_trend(date, date) TO authenticated;

-- ============ 13. ONE-TIME DATA REPAIR (idempotent) ============

-- a) Legacy reallocations logged the destination of a "pull into budget" as
--    a separate pulled_to_period row. The source row now carries that meaning.
WITH legacy AS (
  SELECT p.user_id, p.category_id AS dest_id, p.created_at, p.comment, p.month, p.year
  FROM public.stack_transactions p
  WHERE p.type = 'pulled_to_period' AND p.related_category_id IS NULL
)
UPDATE public.stack_transactions s
SET type = 'pulled_to_period', month = l.month, year = l.year
FROM legacy l
WHERE s.type = 'reallocation_out'
  AND s.user_id = l.user_id
  AND s.created_at = l.created_at
  AND s.related_category_id = l.dest_id
  AND s.comment IS NOT DISTINCT FROM l.comment;

DELETE FROM public.stack_transactions
WHERE type = 'pulled_to_period' AND related_category_id IS NULL;

-- b) accrued_amount = what each closed period has put into its stack so far
UPDATE public.category_periods cp
SET accrued_amount = COALESCE(x.net, 0)
FROM (
  SELECT cp2.id,
         (SELECT SUM(CASE WHEN st.type = 'adjustment_out' THEN -st.amount ELSE st.amount END)
          FROM public.stack_transactions st
          WHERE st.user_id = cp2.user_id AND st.category_id = cp2.category_id
            AND st.month = cp2.month AND st.year = cp2.year
            AND st.type IN ('accrual', 'adjustment_in', 'adjustment_out')) AS net
  FROM public.category_periods cp2
  WHERE cp2.closed
) x
WHERE x.id = cp.id AND cp.accrued_amount IS DISTINCT FROM COALESCE(x.net, 0);

-- c) Periods that 004 opened for back-dated spending (created after the
--    month had already ended) were never budgeted: give them no budget so
--    they cannot accrue phantom money when they close.
UPDATE public.category_periods cp
SET budgeted_amount = 0
WHERE cp.closed = false
  AND cp.budgeted_amount <> 0
  AND make_date(cp.year, cp.month, 1) < date_trunc('month', public.app_today(cp.user_id))::date
  AND (cp.created_at AT TIME ZONE public.app_timezone(cp.user_id))::date
      >= (make_date(cp.year, cp.month, 1) + interval '1 month')::date;

-- d) Every (category, month) with spending gets a period row
INSERT INTO public.category_periods (user_id, category_id, month, year, budgeted_amount, closed, closed_at)
SELECT DISTINCT ON (t.user_id, t.category_id, date_trunc('month', t.txn_date))
  t.user_id,
  t.category_id,
  EXTRACT(MONTH FROM t.txn_date)::int,
  EXTRACT(YEAR FROM t.txn_date)::int,
  CASE
    WHEN date_trunc('month', t.txn_date)::date < date_trunc('month', public.app_today(t.user_id))::date THEN 0
    WHEN c.is_active THEN c.monthly_budget_amount
    ELSE 0
  END,
  date_trunc('month', t.txn_date)::date < date_trunc('month', public.app_today(t.user_id))::date,
  CASE WHEN date_trunc('month', t.txn_date)::date < date_trunc('month', public.app_today(t.user_id))::date
       THEN now() END
FROM public.transactions t
JOIN public.categories c ON c.id = t.category_id AND c.user_id = t.user_id
WHERE t.category_id IS NOT NULL
ON CONFLICT (user_id, category_id, month, year) DO NOTHING;

-- e) spent_amount = the real sum of transactions (fixes drift from the
--    missing UPDATE trigger and the inconsistent closed-period handling)
UPDATE public.category_periods cp
SET spent_amount = x.total
FROM (
  SELECT cp2.id,
         COALESCE((
           SELECT SUM(t.amount) FROM public.transactions t
           WHERE t.user_id = cp2.user_id AND t.category_id = cp2.category_id
             AND t.txn_date >= make_date(cp2.year, cp2.month, 1)
             AND t.txn_date < (make_date(cp2.year, cp2.month, 1) + interval '1 month')::date
         ), 0) AS total
  FROM public.category_periods cp2
) x
WHERE x.id = cp.id AND cp.spent_amount IS DISTINCT FROM x.total;

-- f) Closed months: make each stack reflect what really went unspent
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.category_periods WHERE closed ORDER BY year, month LOOP
    PERFORM public.rebalance_closed_period(r.id, 'Reconciled during the Ledger 005 upgrade');
  END LOOP;
END $$;

-- g) Every category has a stack row
INSERT INTO public.category_stacks (user_id, category_id, current_balance)
SELECT c.user_id, c.id, 0 FROM public.categories c
ON CONFLICT (user_id, category_id) DO NOTHING;

-- h) Loan statuses follow the actual repayments. Loans someone marked as
--    repaid by hand keep that status: the missing amount is recorded as a
--    settlement repayment instead of flipping them back to outstanding.
INSERT INTO public.loan_repayments (loan_id, user_id, amount, repaid_date, notes)
SELECT l.id, l.user_id, l.amount - COALESCE(r.total, 0),
       GREATEST(l.date_lent, COALESCE(r.last_date, public.app_today(l.user_id))),
       'Settled (recorded during the Ledger 005 upgrade)'
FROM public.loans l
LEFT JOIN (
  SELECT loan_id, SUM(amount) AS total, MAX(repaid_date) AS last_date
  FROM public.loan_repayments GROUP BY loan_id
) r ON r.loan_id = l.id
WHERE l.status = 'repaid' AND l.amount - COALESCE(r.total, 0) > 0;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.loans LOOP
    PERFORM public.recompute_loan_status(r.id);
  END LOOP;
END $$;

-- i) Archived categories release their unspent budget and stop recurring
UPDATE public.category_periods cp
SET budgeted_amount = LEAST(cp.budgeted_amount, cp.spent_amount)
FROM public.categories c
WHERE c.id = cp.category_id AND NOT c.is_active AND cp.closed = false
  AND cp.budgeted_amount > cp.spent_amount;

UPDATE public.recurring_transactions r
SET is_active = false
FROM public.categories c
WHERE c.id = r.category_id AND NOT c.is_active AND r.is_active;

-- j) Close finished months and open the current one for everybody now
SELECT public.sync_all_periods();

-- ============ 14. SCHEDULED JOBS (pg_cron) ============
-- The budget engine now runs inside Postgres: no HTTP, no secrets.
-- The two e-mail jobs still call Edge Functions and need these Vault
-- secrets (run once, with your values, if you have not already):
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<your secret / service_role key>', 'service_key');
--
-- Deploy those two functions with --no-verify-jwt; they check the key themselves.

DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not enabled: skipping schedules. Months still roll over lazily when users open the app.';
    RETURN;
  END IF;

  -- Legacy jobs: closed the month on the 28th and could not authenticate
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('open-new-periods', 'close-periods-accrue-stacks');

  -- Hourly, so every timezone rolls over within an hour of local midnight
  PERFORM cron.schedule('ledger-sync-periods', '7 * * * *', 'SELECT public.sync_all_periods();');

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net is not enabled: skipping the e-mail jobs.';
    RETURN;
  END IF;

  -- Daily 09:00 IST (03:30 UTC): loan reminders
  PERFORM cron.schedule('loan-reminders-daily', '30 3 * * *', $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/loan-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$);

  -- 2nd-5th of the month 09:00 IST: monthly report for the previous month
  -- (runs on several days so a failed send is retried; sent reports are skipped)
  PERFORM cron.schedule('monthly-email-report', '30 3 2-5 * *', $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/monthly-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$);
END
$cron$;

COMMIT;
