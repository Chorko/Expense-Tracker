-- Run after applying 005 a second time: nothing should have changed
\set ON_ERROR_STOP 1
DO $$
DECLARE
  v_diff int;
BEGIN
  SELECT count(*) INTO v_diff
  FROM public.zz_snapshot s
  FULL JOIN public.category_stacks c ON c.category_id = s.category_id
  WHERE c.current_balance IS DISTINCT FROM s.current_balance;
  IF v_diff > 0 THEN
    RAISE EXCEPTION 'TEST FAIL: % stack balances changed on re-run', v_diff;
  END IF;

  SELECT count(*) INTO v_diff
  FROM public.zz_snapshot_periods s
  FULL JOIN public.category_periods p ON p.id = s.id
  WHERE (p.budgeted_amount, p.rollover_in, p.spent_amount, p.closed, p.accrued_amount)
        IS DISTINCT FROM (s.budgeted_amount, s.rollover_in, s.spent_amount, s.closed, s.accrued_amount);
  IF v_diff > 0 THEN
    RAISE EXCEPTION 'TEST FAIL: % periods changed on re-run', v_diff;
  END IF;
  RAISE NOTICE 'pass: re-running 005 is a no-op';
END $$;
