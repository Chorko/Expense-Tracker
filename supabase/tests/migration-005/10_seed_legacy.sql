-- Simulate a database that has been running on migrations 001-004
\set u1 '''11111111-1111-1111-1111-111111111111'''::uuid
\set u2 '''22222222-2222-2222-2222-222222222222'''::uuid
\set food '''a0000000-0000-0000-0000-000000000001'''::uuid
\set rent '''a0000000-0000-0000-0000-000000000002'''::uuid
\set fun '''a0000000-0000-0000-0000-000000000003'''::uuid
\set travel '''a0000000-0000-0000-0000-000000000004'''::uuid
\set chennai '''a0000000-0000-0000-0000-000000000005'''::uuid
\set groc '''b0000000-0000-0000-0000-000000000001'''::uuid

CREATE TEMP TABLE d AS
SELECT date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'))::date AS cur,
       (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')) - interval '1 month')::date AS prev,
       (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')) - interval '2 month')::date AS m2,
       (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')) - interval '3 month')::date AS m3;

INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
  (:u1, 'alice@example.com', '{"display_name":"Alice"}', now()),
  (:u2, 'bob@example.com', '{}', now());

INSERT INTO categories (id, user_id, name, monthly_budget_amount, icon, created_at, parent_id)
SELECT * FROM (VALUES
  (:food, :u1, 'Food', 5000, '🍽️', (SELECT m3 FROM d)::timestamptz, NULL::uuid),
  (:rent, :u1, 'Rent', 9500, '🏠', (SELECT m3 FROM d)::timestamptz, NULL::uuid),
  (:fun, :u1, 'Fun', 2000, '🎬', (SELECT m3 FROM d)::timestamptz, NULL::uuid),
  (:travel, :u1, 'Travel', 0, '✈️', (SELECT m3 FROM d)::timestamptz, NULL::uuid),
  (:chennai, :u1, 'Chennai', 2000, '🚌', (SELECT m3 FROM d)::timestamptz, :travel),
  (:groc, :u2, 'Groceries', 3000, '🛒', (SELECT cur FROM d)::timestamptz, NULL::uuid)
) v;

INSERT INTO category_groups (id, user_id, name) VALUES ('c0000000-0000-0000-0000-000000000002', :u2, 'Bob group');

-- Legacy closed month m3 for Food with an over-credited accrual (1000; real leftover is 800)
INSERT INTO category_periods (user_id, category_id, month, year, budgeted_amount, closed, closed_at, created_at)
SELECT :u1, :food, EXTRACT(MONTH FROM m3), EXTRACT(YEAR FROM m3), 5000, true, m3 + 27, m3 FROM d;
INSERT INTO stack_transactions (user_id, category_id, type, amount, month, year, comment)
SELECT :u1, :food, 'accrual', 1000, EXTRACT(MONTH FROM m3), EXTRACT(YEAR FROM m3), 'Month-end rollover: unused budget accrued to stack' FROM d;

-- Previous and current month periods, created during their own month (never closed: cron was broken)
INSERT INTO category_periods (user_id, category_id, month, year, budgeted_amount, created_at)
SELECT c.user_id, c.id, EXTRACT(MONTH FROM x.m), EXTRACT(YEAR FROM x.m), c.monthly_budget_amount, x.m
FROM categories c CROSS JOIN (SELECT prev AS m FROM d UNION ALL SELECT cur FROM d) x
WHERE c.user_id = :u1;
INSERT INTO category_periods (user_id, category_id, month, year, budgeted_amount, created_at)
SELECT :u2, :groc, EXTRACT(MONTH FROM cur), EXTRACT(YEAR FROM cur), 3000, cur FROM d;

-- Food stack got the 1000 accrual, then 100 was moved to Fun's current budget (below)
INSERT INTO category_stacks (user_id, category_id, current_balance)
SELECT user_id, id, CASE WHEN id = :food THEN 900 ELSE 0 END FROM categories;

-- Legacy transactions (004 trigger active: it even adds spend to closed periods)
INSERT INTO transactions (user_id, category_id, amount, txn_date, description)
SELECT :u1, :food, 4200, m3 + 5, 'm3 food' FROM d
UNION ALL SELECT :u1, :fun, 300, m2 + 10, 'backdated fun' FROM d
UNION ALL SELECT :u1, :food, 3000, prev + 3, 'prev food' FROM d
UNION ALL SELECT :u1, :rent, 9500, prev + 1, 'prev rent' FROM d
UNION ALL SELECT :u1, :fun, 2500, prev + 4, 'prev fun' FROM d
UNION ALL SELECT :u1, :chennai, 500, prev + 6, 'prev chennai' FROM d
UNION ALL SELECT :u1, :food, 1000, cur, 'cur food' FROM d
UNION ALL SELECT :u1, :rent, 9500, cur, 'cur rent' FROM d
UNION ALL SELECT :u2, :groc, 800, cur, 'bob groceries' FROM d;

-- Legacy had no UPDATE trigger: this edit drifts spent_amount (stays 1000)
UPDATE transactions SET amount = 1200 WHERE description = 'cur food';

-- Legacy reallocate_stack('period'): two rows with the same created_at
INSERT INTO stack_transactions (user_id, category_id, type, amount, related_category_id, comment, created_at)
VALUES (:u1, :food, 'reallocation_out', 100, :fun, 'legacy move', '2026-10-05 10:00:00+00');
INSERT INTO stack_transactions (user_id, category_id, type, amount, month, year, comment, created_at)
SELECT :u1, :fun, 'pulled_to_period', 100, EXTRACT(MONTH FROM cur), EXTRACT(YEAR FROM cur), 'legacy move',
       '2026-10-05 10:00:00+00' FROM d;
UPDATE category_periods SET rollover_in = 100
WHERE category_id = :fun AND month = (SELECT EXTRACT(MONTH FROM cur) FROM d) AND year = (SELECT EXTRACT(YEAR FROM cur) FROM d);

-- Loans: A partially repaid (trigger), B marked repaid without repayments
INSERT INTO loans (id, user_id, borrower_name, amount, direction, reminder_date)
VALUES ('d0000000-0000-0000-0000-00000000000a', :u1, 'Vikram', 5000, 'lent_out',
        (now() AT TIME ZONE 'Asia/Kolkata')::date - 2);
INSERT INTO loan_repayments (loan_id, user_id, amount) VALUES ('d0000000-0000-0000-0000-00000000000a', :u1, 2000);
INSERT INTO loans (id, user_id, borrower_name, amount, direction, status)
VALUES ('d0000000-0000-0000-0000-00000000000b', :u1, 'Bank', 10000, 'borrowed_in', 'repaid');
INSERT INTO loans (id, user_id, borrower_name, amount)
VALUES ('d0000000-0000-0000-0000-00000000000c', :u2, 'Carol', 700);

-- Recurring rules (never posted by the old app)
INSERT INTO recurring_transactions (id, user_id, category_id, amount, description, frequency, next_due_date)
VALUES ('e0000000-0000-0000-0000-000000000001', :u1, :fun, 649, 'Netflix', 'monthly', '2026-08-31');
INSERT INTO recurring_transactions (id, user_id, category_id, amount, description, frequency, next_due_date)
SELECT 'e0000000-0000-0000-0000-000000000002', :u2, :groc, 50, 'Milk', 'daily',
       (now() AT TIME ZONE 'Asia/Kolkata')::date - 2;
