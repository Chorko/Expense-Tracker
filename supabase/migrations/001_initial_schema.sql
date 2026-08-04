-- ============================================================
-- Personal Finance Tracker v2 — Full Schema
-- Run this in Supabase SQL Editor or via supabase db push
-- ============================================================

-- ============ CORE TABLES ============

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  monthly_income numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color_hex text NOT NULL DEFAULT '#c9a84c',
  sort_order int DEFAULT 0,
  is_sweep_eligible boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES category_groups(id) ON DELETE SET NULL,
  name text NOT NULL,
  monthly_budget_amount numeric NOT NULL DEFAULT 0,
  is_flexible boolean DEFAULT false,
  is_active boolean DEFAULT true,
  icon text DEFAULT '💰',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  description text,
  txn_date date NOT NULL DEFAULT CURRENT_DATE,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  description text,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  next_due_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  current_amount numeric DEFAULT 0,
  target_date date,
  color_hex text DEFAULT '#2dd4bf',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_reports_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_type text NOT NULL DEFAULT 'monthly', -- 'monthly' | 'loan_reminder'
  month int,
  year int,
  sent_at timestamptz DEFAULT now(),
  status text DEFAULT 'sent'
);

-- ============ BUDGET ENGINE: ROLLOVER STACKS ============

-- One row per category per month — the "live" budget instance
CREATE TABLE IF NOT EXISTS category_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year int NOT NULL CHECK (year > 2000),
  budgeted_amount numeric NOT NULL DEFAULT 0,   -- snapshot at period open
  rollover_in numeric DEFAULT 0,                 -- manually pulled from stack this month
  spent_amount numeric DEFAULT 0,                -- kept live as transactions post
  closed boolean DEFAULT false,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, category_id, month, year)
);

-- Per-category persistent accumulator — grows indefinitely until manually moved
CREATE TABLE IF NOT EXISTS category_stacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_balance numeric DEFAULT 0 CHECK (current_balance >= 0),
  last_updated timestamptz DEFAULT now(),
  UNIQUE (user_id, category_id)
);

-- Full audit trail of every stack movement
CREATE TABLE IF NOT EXISTS stack_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL, -- whose stack this affects
  type text NOT NULL CHECK (type IN ('accrual', 'reallocation_out', 'reallocation_in', 'pulled_to_period')),
  amount numeric NOT NULL CHECK (amount > 0),
  related_category_id uuid REFERENCES categories(id) ON DELETE SET NULL, -- other side of reallocation
  related_stock_purchase_id uuid,  -- set if funding a stock buy (FK added after stock_purchases created)
  comment text,
  month int,
  year int,
  created_at timestamptz DEFAULT now()
);

-- Stock purchases with funding receipt
CREATE TABLE IF NOT EXISTS stock_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  ticker_or_note text,
  funded_from jsonb DEFAULT '[]'::jsonb, -- [{category, category_id, amount}]
  created_at timestamptz DEFAULT now()
);

-- Add FK from stack_transactions to stock_purchases now that table exists
ALTER TABLE stack_transactions
  ADD CONSTRAINT fk_stack_txn_stock_purchase
  FOREIGN KEY (related_stock_purchase_id)
  REFERENCES stock_purchases(id)
  ON DELETE SET NULL;

-- ============ LENDING TRACKER ============

CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  borrower_name text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  date_lent date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  expected_return_date date,
  reminder_date date,
  status text NOT NULL DEFAULT 'outstanding'
    CHECK (status IN ('outstanding', 'partially_repaid', 'repaid')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  repaid_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_category_periods_lookup ON category_periods(user_id, month, year);
CREATE INDEX IF NOT EXISTS idx_category_periods_category ON category_periods(category_id, month, year);
CREATE INDEX IF NOT EXISTS idx_stack_transactions_user ON stack_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stack_transactions_category ON stack_transactions(category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_reminders ON loans(user_id, status, reminder_date);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON loan_repayments(loan_id);

-- ============ TRIGGERS ============

-- Auto-update category_periods.spent_amount on transaction insert
CREATE OR REPLACE FUNCTION sync_period_spent_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    UPDATE category_periods
    SET spent_amount = spent_amount + NEW.amount
    WHERE user_id = NEW.user_id
      AND category_id = NEW.category_id
      AND month = EXTRACT(MONTH FROM NEW.txn_date)::int
      AND year = EXTRACT(YEAR FROM NEW.txn_date)::int
      AND closed = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_transaction_insert_sync_period
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION sync_period_spent_on_insert();

-- Auto-reverse spent_amount on transaction delete
CREATE OR REPLACE FUNCTION sync_period_spent_on_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.category_id IS NOT NULL THEN
    UPDATE category_periods
    SET spent_amount = GREATEST(0, spent_amount - OLD.amount)
    WHERE user_id = OLD.user_id
      AND category_id = OLD.category_id
      AND month = EXTRACT(MONTH FROM OLD.txn_date)::int
      AND year = EXTRACT(YEAR FROM OLD.txn_date)::int
      AND closed = false;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER trg_transaction_delete_sync_period
  AFTER DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION sync_period_spent_on_delete();

-- Auto-update loan status when repayments are added
CREATE OR REPLACE FUNCTION sync_loan_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_repaid numeric;
  v_loan_amount numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total_repaid
  FROM loan_repayments WHERE loan_id = NEW.loan_id;

  SELECT amount INTO v_loan_amount FROM loans WHERE id = NEW.loan_id;

  IF v_total_repaid >= v_loan_amount THEN
    UPDATE loans SET status = 'repaid' WHERE id = NEW.loan_id;
  ELSIF v_total_repaid > 0 THEN
    UPDATE loans SET status = 'partially_repaid' WHERE id = NEW.loan_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_loan_repayment_sync_status
  AFTER INSERT ON loan_repayments
  FOR EACH ROW EXECUTE FUNCTION sync_loan_status();

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============ RLS — ENABLE + POLICIES ============

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_reports_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stack_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Category groups
DROP POLICY IF EXISTS "category_groups_own" ON category_groups;
CREATE POLICY "category_groups_own" ON category_groups FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Categories
DROP POLICY IF EXISTS "categories_own" ON categories;
CREATE POLICY "categories_own" ON categories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions
DROP POLICY IF EXISTS "transactions_own" ON transactions;
CREATE POLICY "transactions_own" ON transactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recurring transactions
DROP POLICY IF EXISTS "recurring_transactions_own" ON recurring_transactions;
CREATE POLICY "recurring_transactions_own" ON recurring_transactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Goals
DROP POLICY IF EXISTS "goals_own" ON goals;
CREATE POLICY "goals_own" ON goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email reports log
DROP POLICY IF EXISTS "email_reports_log_own" ON email_reports_log;
CREATE POLICY "email_reports_log_own" ON email_reports_log FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Category periods
DROP POLICY IF EXISTS "category_periods_own" ON category_periods;
CREATE POLICY "category_periods_own" ON category_periods FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Category stacks
DROP POLICY IF EXISTS "category_stacks_own" ON category_stacks;
CREATE POLICY "category_stacks_own" ON category_stacks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Stack transactions
DROP POLICY IF EXISTS "stack_transactions_own" ON stack_transactions;
CREATE POLICY "stack_transactions_own" ON stack_transactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Stock purchases
DROP POLICY IF EXISTS "stock_purchases_own" ON stock_purchases;
CREATE POLICY "stock_purchases_own" ON stock_purchases FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Loans
DROP POLICY IF EXISTS "loans_own" ON loans;
CREATE POLICY "loans_own" ON loans FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Loan repayments
DROP POLICY IF EXISTS "loan_repayments_own" ON loan_repayments;
CREATE POLICY "loan_repayments_own" ON loan_repayments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
