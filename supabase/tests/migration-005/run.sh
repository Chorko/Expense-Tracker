#!/bin/sh
# Verifies migrations 001-005 against the real Supabase Postgres image
# (pg_cron, pg_net, Vault, auth schema and Supabase roles included).
# Runs as the non-superuser `postgres` role, like the hosted SQL editor.
#
# From the repository root:
#   docker run -d --rm --name ledger-db-test -e POSTGRES_PASSWORD=postgres supabase/postgres:17.11.0.004
#   sleep 25
#   docker cp supabase/tests/migration-005 ledger-db-test:/t
#   docker cp supabase/migrations ledger-db-test:/m
#   docker exec ledger-db-test sh /t/run.sh
#   docker rm -f ledger-db-test
#
# Expected: ~108 "pass:" lines, "ALL TESTS PASSED" and "ALL OK" at the end.
set -e

# GoTrue adds these auth.users columns at runtime; the bare image lacks them
psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -f /t/05_gotrue_columns.sql

for f in \
  /m/001_initial_schema.sql \
  /m/002_functions_and_cron.sql \
  /m/003_subcategories_and_borrowed_loans.sql \
  /m/004_fix_missing_profiles_and_sync_trigger.sql \
  /t/10_seed_legacy.sql \
  /m/005_hardening_sync_and_features.sql \
  /t/20_tests.sql \
  /m/005_hardening_sync_and_features.sql \
  /t/30_rerun_check.sql \
  /t/40_cron_check.sql
do
  echo "== $f"
  if ! psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$f" > /tmp/out.txt 2>&1; then
    grep -v 'does not exist, skipping\|already exists, skipping' /tmp/out.txt
    echo "!! FAILED in $f"
    exit 1
  fi
  grep -i 'pass:\|fail\|error\|ALL TESTS' /tmp/out.txt | sed 's/^psql:[^ ]* NOTICE:  //' || true
done
echo "ALL OK"
