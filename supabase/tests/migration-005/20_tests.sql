-- Behavioural tests for migration 005 (run after 10_seed_legacy + 005)
\set ON_ERROR_STOP 1
SET client_min_messages = warning;

CREATE FUNCTION pg_temp.per(p_cat uuid, p_offset int) RETURNS public.category_periods
LANGUAGE sql AS $$
  SELECT * FROM public.category_periods
  WHERE category_id = p_cat
    AND make_date(year, month, 1) =
        (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - make_interval(months => p_offset))::date
$$;

CREATE FUNCTION pg_temp.stack(p_cat uuid) RETURNS numeric
LANGUAGE sql AS $$ SELECT current_balance FROM public.category_stacks WHERE category_id = p_cat $$;

CREATE FUNCTION pg_temp.eq(p_label text, p_actual numeric, p_expected numeric) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'TEST FAIL [%]: expected %, got %', p_label, p_expected, p_actual;
  END IF;
  RAISE NOTICE 'pass: %', p_label;
END $$;

CREATE FUNCTION pg_temp.err(p_label text, p_sql text, p_pattern text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE p_pattern THEN
      RAISE NOTICE 'pass: % (%)', p_label, SQLERRM;
      RETURN;
    END IF;
    RAISE EXCEPTION 'TEST FAIL [%]: wrong error: %', p_label, SQLERRM;
  END;
  RAISE EXCEPTION 'TEST FAIL [%]: expected an error matching %', p_label, p_pattern;
END $$;

CREATE FUNCTION pg_temp.as_user(p_uid text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
  PERFORM set_config('request.jwt.claim.sub', p_uid, false);
END $$;

SET client_min_messages = notice;

-- Net stack movement recorded in the audit trail for one category
CREATE FUNCTION pg_temp.ledger(p_cat uuid) RETURNS numeric
LANGUAGE sql AS $$
  SELECT COALESCE(SUM(CASE WHEN type IN ('accrual', 'adjustment_in', 'reallocation_in') THEN amount ELSE -amount END), 0)
  FROM public.stack_transactions WHERE category_id = p_cat
$$;

\echo '--- 1. data repair'
SELECT pg_temp.eq('food m3 spent recomputed', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 3)).spent_amount, 4200);
SELECT pg_temp.eq('food m3 accrual reconciled to real leftover', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 3)).accrued_amount, 800);
SELECT pg_temp.eq('food prev accrued', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 1)).accrued_amount, 2000);
SELECT pg_temp.eq('food prev closed', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 1)).closed::int, 1);
SELECT pg_temp.eq('food cur open', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 0)).closed::int, 0);
SELECT pg_temp.eq('food cur drift fixed (edit 1000->1200)', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 0)).spent_amount, 1200);
SELECT pg_temp.eq('food stack', pg_temp.stack('a0000000-0000-0000-0000-000000000001'), 2700);
SELECT pg_temp.eq('fun m2 phantom budget removed', (pg_temp.per('a0000000-0000-0000-0000-000000000003', 2)).budgeted_amount, 0);
SELECT pg_temp.eq('fun m2 spent incl. netflix catch-up', (pg_temp.per('a0000000-0000-0000-0000-000000000003', 2)).spent_amount, 949);
SELECT pg_temp.eq('fun prev spent incl. netflix (31st clamped to 30th)', (pg_temp.per('a0000000-0000-0000-0000-000000000003', 1)).spent_amount, 3149);
SELECT pg_temp.eq('fun cur rollover kept', (pg_temp.per('a0000000-0000-0000-0000-000000000003', 0)).rollover_in, 100);
SELECT pg_temp.eq('fun stack', pg_temp.stack('a0000000-0000-0000-0000-000000000003'), 0);
SELECT pg_temp.eq('chennai stack', pg_temp.stack('a0000000-0000-0000-0000-000000000005'), 1500);
SELECT pg_temp.eq('bob groceries spent incl. 3 milk', (pg_temp.per('b0000000-0000-0000-0000-000000000001', 0)).spent_amount, 950);
SELECT pg_temp.eq('netflix next due keeps anchor 31',
  (SELECT EXTRACT(DAY FROM next_due_date) FROM recurring_transactions WHERE id = 'e0000000-0000-0000-0000-000000000001'), 31);
SELECT pg_temp.eq('milk next due tomorrow',
  (SELECT next_due_date - (now() AT TIME ZONE 'Asia/Kolkata')::date FROM recurring_transactions WHERE id = 'e0000000-0000-0000-0000-000000000002'), 1);
SELECT pg_temp.eq('legacy pull converted', (SELECT count(*) FROM stack_transactions
  WHERE type = 'pulled_to_period' AND category_id = 'a0000000-0000-0000-0000-000000000001'
    AND related_category_id = 'a0000000-0000-0000-0000-000000000003'), 1);
SELECT pg_temp.eq('legacy dest rows removed', (SELECT count(*) FROM stack_transactions
  WHERE type = 'pulled_to_period' AND related_category_id IS NULL), 0);
SELECT pg_temp.eq('ledger matches every stack', (SELECT count(*) FROM category_stacks s
  WHERE s.current_balance <> pg_temp.ledger(s.category_id)), 0);
SELECT pg_temp.eq('loan A partial', (SELECT (status = 'partially_repaid')::int FROM loans WHERE id = 'd0000000-0000-0000-0000-00000000000a'), 1);
SELECT pg_temp.eq('loan B stays repaid', (SELECT (status = 'repaid')::int FROM loans WHERE id = 'd0000000-0000-0000-0000-00000000000b'), 1);
SELECT pg_temp.eq('loan B settlement recorded', (SELECT SUM(amount) FROM loan_repayments WHERE loan_id = 'd0000000-0000-0000-0000-00000000000b'), 10000);
SELECT pg_temp.eq('profiles onboarded', (SELECT count(*) FROM profiles WHERE onboarded_at IS NOT NULL), 2);
SELECT pg_temp.eq('periods spent == sum(transactions)', (SELECT count(*) FROM category_periods cp WHERE cp.spent_amount <>
  COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.category_id = cp.category_id
    AND date_trunc('month', t.txn_date)::date = make_date(cp.year, cp.month, 1)), 0)), 0);

\echo '--- 2. privileges and RLS (as Alice)'
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SET ROLE authenticated;
SELECT pg_temp.eq('alice sees only her categories', (SELECT count(*) FROM categories), 5);
SELECT pg_temp.eq('alice cannot see bob loans', (SELECT count(*) FROM loans WHERE user_id = '22222222-2222-2222-2222-222222222222'), 0);
UPDATE category_stacks SET current_balance = 99999 WHERE category_id = 'a0000000-0000-0000-0000-000000000001';
SELECT pg_temp.eq('stack unchanged after attempted write', pg_temp.stack('a0000000-0000-0000-0000-000000000001'), 2700);
SELECT pg_temp.err('no direct period inserts',
  $q$INSERT INTO category_periods (user_id, category_id, month, year, budgeted_amount)
     VALUES ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 1, 2030, 1)$q$, '%row-level security%');
SELECT pg_temp.err('no direct stack history inserts',
  $q$INSERT INTO stack_transactions (user_id, category_id, type, amount)
     VALUES ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'accrual', 5)$q$, '%row-level security%');
SELECT pg_temp.err('sync_all_periods is service-only', 'SELECT public.sync_all_periods()', '%permission denied%');
SELECT pg_temp.err('get_due_loan_reminders is service-only', 'SELECT * FROM public.get_due_loan_reminders()', '%permission denied%');
SELECT pg_temp.err('legacy close is service-only', 'SELECT public.close_periods_and_accrue_stacks(1, 2026)', '%permission denied%');
SELECT pg_temp.err('internal helper not callable', $q$SELECT public.sync_user_periods('22222222-2222-2222-2222-222222222222')$q$, '%permission denied%');
SELECT pg_temp.err('reallocate_stack removed', $q$SELECT public.reallocate_stack('22222222-2222-2222-2222-222222222222', '[]', 'stack')$q$, '%does not exist%');
DELETE FROM categories WHERE id = 'a0000000-0000-0000-0000-000000000004';
SELECT pg_temp.eq('category survived delete attempt', (SELECT count(*) FROM categories WHERE id = 'a0000000-0000-0000-0000-000000000004'), 1);
SELECT pg_temp.err('stock amount is not editable',
  $q$UPDATE stock_purchases SET amount = 1$q$, '%permission denied%');
SELECT public.sync_my_periods();
SELECT pg_temp.eq('sync_my_periods is idempotent', pg_temp.stack('a0000000-0000-0000-0000-000000000001'), 2700);
RESET ROLE;

\echo '--- 3. move_stack_money (as Alice)'
INSERT INTO goals (id, user_id, name, target_amount) VALUES
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Goa trip', 10000),
  ('f0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Bob bike', 5000);
SET ROLE authenticated;
SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":500}]',
  'period', 'a0000000-0000-0000-0000-000000000003', NULL, NULL, 'Dinner party');
SELECT pg_temp.eq('period move: source debited', pg_temp.stack('a0000000-0000-0000-0000-000000000001'), 2200);
SELECT pg_temp.eq('period move: dest budget topped up', (pg_temp.per('a0000000-0000-0000-0000-000000000003', 0)).rollover_in, 600);
SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000005","amount":300}]',
  'stack', 'a0000000-0000-0000-0000-000000000002', NULL, NULL, 'Rent buffer');
SELECT pg_temp.eq('stack move: source', pg_temp.stack('a0000000-0000-0000-0000-000000000005'), 1200);
SELECT pg_temp.eq('stack move: dest', pg_temp.stack('a0000000-0000-0000-0000-000000000002'), 300);
SELECT (public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":200},
  {"category_id":"a0000000-0000-0000-0000-000000000005","amount":200}]', 'stock', NULL, NULL, ' NIFTYBEES ', 'SIP top-up'))->>'total' AS stock_total;
SELECT pg_temp.eq('stock purchase total', (SELECT amount FROM stock_purchases WHERE ticker_or_note = 'NIFTYBEES'), 400);
SELECT pg_temp.eq('stock funded_from has names', (SELECT count(*) FROM stock_purchases sp, jsonb_array_elements(sp.funded_from) f
  WHERE f->>'category' IN ('Food', 'Chennai')), 2);
SELECT pg_temp.eq('stock audit rows linked', (SELECT count(*) FROM stack_transactions WHERE related_stock_purchase_id IS NOT NULL), 2);
SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":100}]',
  'goal', NULL, 'f0000000-0000-0000-0000-000000000001', NULL, 'Saving for Goa');
SELECT pg_temp.eq('goal funded', (SELECT current_amount FROM goals WHERE id = 'f0000000-0000-0000-0000-000000000001'), 100);
SELECT pg_temp.eq('food after all moves', pg_temp.stack('a0000000-0000-0000-0000-000000000001'), 1900);
SELECT pg_temp.err('insufficient balance', $q$SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":999999}]',
  'stack', 'a0000000-0000-0000-0000-000000000002', NULL, NULL, 'x')$q$, '%insufficient%');
SELECT pg_temp.err('cannot drain another user stack', $q$SELECT public.move_stack_money('[{"category_id":"b0000000-0000-0000-0000-000000000001","amount":1}]',
  'stack', 'a0000000-0000-0000-0000-000000000002', NULL, NULL, 'x')$q$, '%source stack not found%');
SELECT pg_temp.err('cannot target another user category', $q$SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":1}]',
  'stack', 'b0000000-0000-0000-0000-000000000001', NULL, NULL, 'x')$q$, '%destination category not found%');
SELECT pg_temp.err('cannot fund another user goal', $q$SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":1}]',
  'goal', NULL, 'f0000000-0000-0000-0000-000000000002', NULL, 'x')$q$, '%goal not found%');
SELECT pg_temp.err('comment required', $q$SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":1}]',
  'stack', 'a0000000-0000-0000-0000-000000000002', NULL, NULL, '   ')$q$, '%comment is required%');
SELECT pg_temp.err('same source and destination', $q$SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":1}]',
  'stack', 'a0000000-0000-0000-0000-000000000001', NULL, NULL, 'x')$q$, '%must be different%');
SELECT pg_temp.err('negative amount', $q$SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":-5}]',
  'stack', 'a0000000-0000-0000-0000-000000000002', NULL, NULL, 'x')$q$, '%positive amount%');
SELECT pg_temp.err('stock needs a name', $q$SELECT public.move_stack_money('[{"category_id":"a0000000-0000-0000-0000-000000000001","amount":1}]',
  'stock', NULL, NULL, '  ', 'x')$q$, '%stock name%');
SELECT pg_temp.eq('ledger still matches after moves', (SELECT count(*) FROM category_stacks s
  WHERE s.current_balance <> pg_temp.ledger(s.category_id)), 0);
RESET ROLE;
SELECT pg_temp.eq('bob untouched', pg_temp.stack('b0000000-0000-0000-0000-000000000001'), 0);

\echo '--- 4. transaction sync (as Alice)'
SET ROLE authenticated;
INSERT INTO transactions (id, user_id, category_id, amount, txn_date, description)
VALUES ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'a0000000-0000-0000-0000-000000000001', 300, (now() AT TIME ZONE 'Asia/Kolkata')::date, 'test');
SELECT pg_temp.eq('insert adds spend', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 0)).spent_amount, 1500);
UPDATE transactions SET amount = 500 WHERE id = '70000000-0000-0000-0000-000000000001';
SELECT pg_temp.eq('edit amount syncs', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 0)).spent_amount, 1700);
UPDATE transactions SET txn_date = (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '20 days')::date
WHERE id = '70000000-0000-0000-0000-000000000001';
SELECT pg_temp.eq('moved out of current month', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 0)).spent_amount, 1200);
SELECT pg_temp.eq('moved into closed month', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 1)).spent_amount, 3500);
SELECT pg_temp.eq('closed month claws back stack', pg_temp.stack('a0000000-0000-0000-0000-000000000001'), 1400);
DELETE FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001';
SELECT pg_temp.eq('delete restores closed month', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 1)).spent_amount, 3000);
SELECT pg_temp.eq('delete refunds stack', pg_temp.stack('a0000000-0000-0000-0000-000000000001'), 1900);
INSERT INTO transactions (user_id, category_id, amount, txn_date)
VALUES ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000005', 1400,
        (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '10 days')::date);
SELECT pg_temp.eq('clawback never goes below zero', pg_temp.stack('a0000000-0000-0000-0000-000000000005'), 0);
DELETE FROM transactions WHERE amount = 1400 AND category_id = 'a0000000-0000-0000-0000-000000000005';
SELECT pg_temp.eq('refund after capped clawback', pg_temp.stack('a0000000-0000-0000-0000-000000000005'), 1000);
INSERT INTO transactions (user_id, category_id, amount, txn_date)
VALUES ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 250, '2025-01-15');
SELECT pg_temp.eq('old unbudgeted month: zero budget, closed',
  (SELECT (budgeted_amount = 0 AND closed AND spent_amount = 250)::int FROM category_periods
   WHERE category_id = 'a0000000-0000-0000-0000-000000000001' AND month = 1 AND year = 2025), 1);
SELECT pg_temp.eq('old month does not touch stack', pg_temp.stack('a0000000-0000-0000-0000-000000000001'), 1900);
SELECT pg_temp.err('cannot use another user category',
  $q$INSERT INTO transactions (user_id, category_id, amount) VALUES ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 5)$q$,
  '%category not found%');
SELECT pg_temp.err('cannot insert as another user',
  $q$INSERT INTO transactions (user_id, category_id, amount) VALUES ('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000001', 5)$q$,
  '%row-level security%');
SELECT pg_temp.eq('ledger matches after edits', (SELECT count(*) FROM category_stacks s
  WHERE s.current_balance <> pg_temp.ledger(s.category_id)), 0);
RESET ROLE;

\echo '--- 5. categories (as Alice)'
SET ROLE authenticated;
UPDATE categories SET monthly_budget_amount = 6000 WHERE id = 'a0000000-0000-0000-0000-000000000001';
SELECT pg_temp.eq('budget edit updates open month', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 0)).budgeted_amount, 6000);
SELECT pg_temp.eq('budget edit leaves closed month', (pg_temp.per('a0000000-0000-0000-0000-000000000001', 1)).budgeted_amount, 5000);
UPDATE categories SET is_active = false WHERE id = 'a0000000-0000-0000-0000-000000000003';
SELECT pg_temp.eq('archive releases unspent budget', (pg_temp.per('a0000000-0000-0000-0000-000000000003', 0)).budgeted_amount, 0);
SELECT pg_temp.eq('archive pauses recurring', (SELECT is_active::int FROM recurring_transactions WHERE id = 'e0000000-0000-0000-0000-000000000001'), 0);
UPDATE categories SET is_active = true WHERE id = 'a0000000-0000-0000-0000-000000000003';
SELECT pg_temp.eq('restore reopens budget', (pg_temp.per('a0000000-0000-0000-0000-000000000003', 0)).budgeted_amount, 2000);
UPDATE categories SET is_active = false WHERE id = 'a0000000-0000-0000-0000-000000000004';
SELECT pg_temp.eq('archiving a parent archives children', (SELECT is_active::int FROM categories WHERE id = 'a0000000-0000-0000-0000-000000000005'), 0);
UPDATE categories SET is_active = true WHERE id IN ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005');
INSERT INTO categories (id, user_id, name, monthly_budget_amount) VALUES
  ('a0000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', '  Gym  ', 1500);
SELECT pg_temp.eq('new category gets current period', (pg_temp.per('a0000000-0000-0000-0000-000000000009', 0)).budgeted_amount, 1500);
SELECT pg_temp.eq('new category gets a stack', pg_temp.stack('a0000000-0000-0000-0000-000000000009'), 0);
SELECT pg_temp.eq('name trimmed', (SELECT count(*) FROM categories WHERE name = 'Gym'), 1);
SELECT pg_temp.err('only one level of sub-categories',
  $q$INSERT INTO categories (user_id, name, parent_id) VALUES ('11111111-1111-1111-1111-111111111111', 'Bus', 'a0000000-0000-0000-0000-000000000005')$q$,
  '%one level deep%');
SELECT pg_temp.err('parent with children cannot become a child',
  $q$UPDATE categories SET parent_id = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'a0000000-0000-0000-0000-000000000004'$q$,
  '%has sub-categories%');
SELECT pg_temp.err('cannot use another user group',
  $q$INSERT INTO categories (user_id, name, group_id) VALUES ('11111111-1111-1111-1111-111111111111', 'X', 'c0000000-0000-0000-0000-000000000002')$q$,
  '%group not found%');
SELECT pg_temp.err('blank name rejected',
  $q$INSERT INTO categories (user_id, name) VALUES ('11111111-1111-1111-1111-111111111111', '   ')$q$, '%name is required%');
RESET ROLE;

\echo '--- 6. service role'
SET ROLE service_role;
SELECT pg_temp.eq('due reminders', (SELECT count(*) FROM public.get_due_loan_reminders()), 1);
SELECT pg_temp.eq('reminder outstanding', (SELECT outstanding FROM public.get_due_loan_reminders()), 3000);
SELECT pg_temp.eq('reminder days overdue', (SELECT days_overdue FROM public.get_due_loan_reminders()), 2);
SELECT pg_temp.eq('report recipients', (SELECT count(*) FROM public.get_report_recipients()), 2);
SELECT pg_temp.eq('mark reminded', public.mark_loans_reminded(ARRAY['d0000000-0000-0000-0000-00000000000a']::uuid[]), 1);
SELECT pg_temp.eq('reminded loans wait a week', (SELECT count(*) FROM public.get_due_loan_reminders()), 0);
RESET ROLE;
UPDATE loans SET reminder_date = (now() AT TIME ZONE 'Asia/Kolkata')::date - 1 WHERE id = 'd0000000-0000-0000-0000-00000000000a';
SET ROLE service_role;
SELECT pg_temp.eq('moving the reminder date re-arms it', (SELECT count(*) FROM public.get_due_loan_reminders()), 1);
RESET ROLE;
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SET ROLE authenticated;
SELECT pg_temp.err('mark_loans_reminded is service-only',
  $q$SELECT public.mark_loans_reminded(ARRAY['d0000000-0000-0000-0000-00000000000a']::uuid[])$q$, '%permission denied%');
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.eq('sync_all_periods callable', public.sync_all_periods(), 2);
RESET ROLE;

\echo '--- 7. loans (as Alice)'
SET ROLE authenticated;
SELECT pg_temp.err('repayment above outstanding',
  $q$INSERT INTO loan_repayments (loan_id, user_id, amount) VALUES ('d0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 3500)$q$,
  '%exceeds the outstanding balance%');
SELECT pg_temp.err('repayment on another user loan',
  $q$INSERT INTO loan_repayments (loan_id, user_id, amount) VALUES ('d0000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 1)$q$,
  '%loan not found%');
INSERT INTO loan_repayments (id, loan_id, user_id, amount)
VALUES ('80000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 3000);
SELECT pg_temp.eq('fully repaid', (SELECT (status = 'repaid')::int FROM loans WHERE id = 'd0000000-0000-0000-0000-00000000000a'), 1);
DELETE FROM loan_repayments WHERE id = '80000000-0000-0000-0000-000000000001';
SELECT pg_temp.eq('deleting a repayment reopens the loan', (SELECT (status = 'partially_repaid')::int FROM loans WHERE id = 'd0000000-0000-0000-0000-00000000000a'), 1);
SELECT pg_temp.err('amount below repaid rejected',
  $q$UPDATE loans SET amount = 1500 WHERE id = 'd0000000-0000-0000-0000-00000000000a'$q$, '%already been repaid%');
UPDATE loans SET amount = 2000 WHERE id = 'd0000000-0000-0000-0000-00000000000a';
SELECT pg_temp.eq('lowering amount to repaid settles it', (SELECT (status = 'repaid')::int FROM loans WHERE id = 'd0000000-0000-0000-0000-00000000000a'), 1);

\echo '--- 8. goals + trend (as Alice)'
SELECT pg_temp.eq('goal contribution', public.adjust_goal_amount('f0000000-0000-0000-0000-000000000001', 50), 150);
SELECT pg_temp.eq('goal withdrawal clamps at zero', public.adjust_goal_amount('f0000000-0000-0000-0000-000000000001', -1000), 0);
SELECT pg_temp.err('cannot adjust another user goal',
  $q$SELECT public.adjust_goal_amount('f0000000-0000-0000-0000-000000000002', 10)$q$, '%goal not found%');
SELECT pg_temp.eq('trend has 6 months', (SELECT count(*) FROM public.monthly_trend(
  (date_trunc('month', now()) - interval '5 months')::date, now()::date)), 6);
SELECT pg_temp.eq('trend spend matches transactions', (SELECT SUM(spent) FROM public.monthly_trend(
  (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '5 months')::date, (now() AT TIME ZONE 'Asia/Kolkata')::date)),
  (SELECT SUM(amount) FROM transactions WHERE txn_date >= (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '5 months')::date));
RESET ROLE;

\echo '--- 9. date helpers'
SELECT pg_temp.eq('jan 31 -> feb 28', public.next_recurring_date('2027-01-31', 'monthly', 31) - '2027-02-28'::date, 0);
SELECT pg_temp.eq('feb 28 -> mar 31 (anchor kept)', public.next_recurring_date('2027-02-28', 'monthly', 31) - '2027-03-31'::date, 0);
SELECT pg_temp.eq('leap day yearly', public.next_recurring_date('2028-02-29', 'yearly', 29) - '2029-02-28'::date, 0);
SELECT pg_temp.eq('weekly', public.next_recurring_date('2027-12-29', 'weekly', NULL) - '2028-01-05'::date, 0);
SELECT pg_temp.eq('bad timezone falls back', (SELECT (public.app_timezone('11111111-1111-1111-1111-111111111111') = 'Asia/Kolkata')::int), 1);
UPDATE profiles SET timezone = 'Not/AZone' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT pg_temp.eq('invalid timezone tolerated', (SELECT (public.app_timezone('11111111-1111-1111-1111-111111111111') = 'Asia/Kolkata')::int), 1);
UPDATE profiles SET timezone = 'Asia/Kolkata' WHERE id = '11111111-1111-1111-1111-111111111111';

-- Snapshot for the re-run (idempotency) check
CREATE TABLE public.zz_snapshot AS
SELECT category_id, current_balance FROM category_stacks;
CREATE TABLE public.zz_snapshot_periods AS
SELECT id, budgeted_amount, rollover_in, spent_amount, closed, accrued_amount FROM category_periods;
\echo 'ALL TESTS PASSED'
