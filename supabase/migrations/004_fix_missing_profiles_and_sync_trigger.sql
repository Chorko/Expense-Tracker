-- ============================================================
-- Migration 004: Self-Healing Trigger & Period Upsert Fix
-- ============================================================

-- Ensure profile exists for any registered auth user automatically
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, monthly_income)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    45000
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Upgrade sync_period_spent_on_insert to automatically upsert category_periods if missing
CREATE OR REPLACE FUNCTION sync_period_spent_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_budget numeric := 0;
  v_month int := EXTRACT(MONTH FROM NEW.txn_date)::int;
  v_year  int := EXTRACT(YEAR FROM NEW.txn_date)::int;
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    -- Fetch category default budget amount
    SELECT COALESCE(monthly_budget_amount, 0) INTO v_budget
    FROM categories WHERE id = NEW.category_id;

    -- Upsert category_periods row and add spent amount atomically
    INSERT INTO category_periods (user_id, category_id, month, year, budgeted_amount, spent_amount, rollover_in)
    VALUES (NEW.user_id, NEW.category_id, v_month, v_year, v_budget, NEW.amount, 0)
    ON CONFLICT (user_id, category_id, month, year)
    DO UPDATE SET spent_amount = category_periods.spent_amount + EXCLUDED.spent_amount;

    -- Ensure category_stacks row exists
    INSERT INTO category_stacks (user_id, category_id, current_balance)
    VALUES (NEW.user_id, NEW.category_id, 0)
    ON CONFLICT (user_id, category_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill missing profiles for existing auth.users
INSERT INTO profiles (id, email, display_name, monthly_income)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  45000
FROM auth.users
ON CONFLICT (id) DO NOTHING;
