# Ledger upgrade: plan, context and status

Working branch: `upgrade/ledger-overhaul` · Last update: 16 Oct 2026 · **Progress: about 97%** (only the pass against a live Supabase project remains)

This file is the hand-off for the end-to-end upgrade of Ledger (Next.js 16 + Supabase envelope-budget app).
If a session is lost, read this first, then continue with [Remaining work](#remaining-work).

## Goal (from the request)

Analyse the whole repo, understand the product and architecture, fix what is broken, upgrade dependencies,
improve the UI, and provide the SQL for every Supabase change (the `.env` is added later by the owner).
Commit and push at the end.

## Status at a glance

| # | Task | Status |
|---|------|--------|
| 1 | Generated `types/database.ts` (relationships + RPCs) | Done |
| 2 | Core lib: env, Supabase clients, `proxy.ts`, session/data layer, dates, validation | Done |
| 3 | Server actions rewritten (zod, RLS, revalidation) | Done |
| 4 | Next 16 platform: CSP, `next/font`, deps upgraded / removed | Done |
| 5 | UI primitives: `<dialog>` modal, toasts, responsive shell, error/loading/404 pages | Done |
| 6 | Dashboard redesign | Done |
| 7 | Transactions page (filters, edit/delete, CSV, recurring rules) | Done |
| 8 | Stacks, Investments, Loans pages | Done |
| 9 | New Goals and Settings pages | Done |
| 10 | Auth + onboarding (forgot/reset password, callback, presets) | Done |
| 11 | Edge functions rewrite (`supabase/functions/*`) | Done |
| 12 | README, `.env.example`, lint/build verification | Done |
| 13 | Final commit, PR to `main`, final report | In progress |

Remaining ~3%: a manual pass against the owner's live Supabase project (sign-up, e-mail links, every flow
in a browser) once the `.env` exists, and the pull request.

### Verified at this checkpoint

- `npm run typecheck` (`next typegen && tsc --noEmit`): passes.
- `npm run lint`: 0 problems across the whole project.
- Edge functions: `deno check` and `deno lint` pass on all six files (Deno 2.9.7).
- `next build` (Next 16.4.1, Turbopack): passes, 18 routes, proxy registered, no warnings.
- `next start` smoke test with placeholder env: auth pages return 200, protected routes redirect to
  `/login?next=…`, unknown routes 404, CSP / X-Frame-Options / HSTS headers present.
- Database: `supabase/tests/migration-005/run.sh` runs migrations 001→005 on `supabase/postgres:17.11.0.004`
  as the non-superuser `postgres` role: **112 checks pass** (data repair, RLS, privileges, stack moves,
  triggers, loans, goals, cron jobs, re-running 005 is a no-op).

### Not verified yet

- Nothing has run against the owner's real Supabase project (no `.env` yet): real sign-up/e-mail links,
  PostgREST behaviour with real data, the Edge Function e-mails, and every interactive flow in a browser
  still need a manual pass. This is the only remaining work.

## What the owner must do in Supabase

1. **SQL Editor → run `supabase/migrations/005_hardening_sync_and_features.sql`** (after 001–004). It is one
   transaction and safe to run more than once. The app on this branch requires it; without it every dashboard
   page redirects to `/setup?reason=migration`.
2. Environment for Next.js (`.env.local` / hosting):
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the legacy
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works).
3. Auth → URL configuration: Site URL = the app URL; add `<app-url>/auth/callback` to the redirect URLs.
4. E-mails (optional, after task 11): enable `pg_cron` + `pg_net`, create Vault secrets once:
   `select vault.create_secret('https://<ref>.supabase.co', 'project_url');`
   `select vault.create_secret('<secret or service_role key>', 'service_key');`
   then deploy `loan-reminders` and `monthly-report` with `--no-verify-jwt` and set `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL`, `APP_URL` as function secrets.

## Problems found in the original code (fixed on this branch)

Security
- `reallocate_stack()` trusted a `p_user_id` argument: any signed-in user could move anyone's stack money.
  Replaced by `move_stack_money()`, which only acts on `auth.uid()`.
- `open_new_periods`, `close_periods_and_accrue_stacks` and `get_due_loan_reminders` were callable by every
  API user (cross-tenant writes and an e-mail address leak). Now service-role only.
- RLS policies were `FOR ALL` on ledger tables, so a client could write its own stack balances. Periods,
  stacks, stack history and stock purchases are now read-only for clients (writes go through audited
  functions; only a stock's note is editable).
- Rows could reference another user's category/group/parent/loan by id. Blocked by triggers.
- CSP allowed `unsafe-eval` in production; now development only.

Correctness
- Editing a transaction never updated the budget (no UPDATE trigger). 004's upsert also added spending to
  already-closed months and gave back-dated months a phantom budget. One trigger now handles
  insert/update/delete and rebalances stacks when a closed month changes.
- Cron read `vault.secrets` (encrypted) instead of `vault.decrypted_secrets`, so jobs never authenticated;
  the close job (`28-31 * *`) would also have closed the month on the 28th. Months now roll over in SQL
  (hourly cron) and lazily on page load, per user timezone.
- The dashboard query embedded `category_stacks` under `category_periods` (no FK between them): PostgREST
  error, empty dashboard.
- The sidebar linked to `/dashboard/goals` and `/dashboard/settings`, which did not exist.
- "Today" came from `toISOString()` (UTC): wrong day in India before 05:30.
- Loan status never went back after deleting a repayment; repayments could exceed the loan.
- New users got a hard-coded income of 45,000.
- `middleware.ts` is deprecated in Next 16 (now `proxy.ts`); unused/deprecated deps removed
  (`resend`, `@react-email/components`, `date-fns`); `as any` throughout replaced by generated types.

## Architecture (as of this branch)

```
proxy.ts                      Next 16 proxy → lib/supabase/proxy.ts (getClaims, route guards, cookie refresh)
lib/env.ts                    NEXT_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY (falls back to ANON_KEY)
lib/supabase/{client,server}  browser / server clients typed with types/database.ts
lib/data/*.ts                 server-only reads. session.ts getViewer(): verified user, profile, timezone,
                              today, and runs sync_my_periods() once per request (React cache)
app/actions/*.ts              Server Actions: zod-validate → Supabase (RLS) → refreshDashboard()
lib/actions.ts                getActor, ActionResult helpers, dbFail (shows our P0001 messages, hides others)
lib/budget.ts                 pure: budget lines with sub-category roll-ups, options, stack options
lib/{dates,format,validations,recurring,presets,types}.ts
components/ui/*               Modal (<dialog>), Toast, ConfirmDialog, AmountInput, MonthSwitcher, Pickers…
components/{dashboard,transactions,stacks,loans,goals,categories,auth,layout}/*
app/dashboard/*               Overview, transactions, stacks, goals, loans, stocks (investments), settings
app/(auth)/*, app/auth/callback, app/reset-password, app/onboarding, app/setup
supabase/migrations/005_*     DB hardening + engine (see below)
supabase/tests/migration-005  Docker test harness for 001→005
```

Budget model: each category has a monthly budget → one `category_periods` row per month (`budgeted_amount`,
`rollover_in`, `spent_amount`, `closed`, `accrued_amount`) → when a month closes, unspent money goes to the
category's `category_stacks` balance and is logged in `stack_transactions` (`accrual`). Stack money moves
with `move_stack_money()` to: this month's budget of a category, another stack, a savings goal, or an
investment (stock purchase with a `funded_from` receipt). Every move needs a comment.

### Migration 005 in short

- New columns: `profiles.email_reports_enabled`, `profiles.onboarded_at`, `categories.sort_order`,
  `category_periods.accrued_amount`, `goals.icon`, `recurring_transactions.anchor_day/last_posted_date`,
  `transactions.recurring_id`, `stack_transactions.related_goal_id`; types `adjustment_in/out`.
- Client RPCs (each acts on `auth.uid()`): `sync_my_periods()`, `move_stack_money(...)`,
  `adjust_goal_amount(goal, delta)`, `monthly_trend(from, to)`.
- Service-only: `sync_all_periods()`, `get_due_loan_reminders()` (now with `direction`, `outstanding`,
  `display_name`), `get_report_recipients()`; legacy `open_new_periods` / `close_periods_and_accrue_stacks`
  now just call `sync_all_periods()`.
- Triggers: transaction spend sync, category create/budget-edit/archive, cross-user reference checks,
  one-level sub-categories, recurring anchor day, loan repayment limit + status, loan amount ≥ repaid.
- Recurring transactions post automatically (catch-up, idempotent via a unique index).
- Data repair (idempotent): recomputes spend, reconciles closed-month stacks, fixes phantom budgets,
  converts legacy stack-history rows, settles loans marked repaid without repayments.
- Cron: `ledger-sync-periods` hourly (pure SQL); `loan-reminders-daily` and `monthly-email-report`
  (2nd–5th) call Edge Functions with the `apikey` header from Vault. Old jobs are unscheduled.

## Remaining work

### Task 11: Edge functions (`supabase/functions`)

Current files are the originals (untouched). Plan:

- `_shared/auth.ts` → `requireServiceKey(req)`: accept the `apikey` header or `Authorization: Bearer`, compare
  in constant time with `SUPABASE_SERVICE_ROLE_KEY` or any value in `SUPABASE_SECRET_KEYS` (JSON); else 401.
  Deploy with `--no-verify-jwt` because cron sends only `apikey`.
- `_shared/email.ts` → `escapeHtml`, shared HTML layout, `sendEmail()` (Resend via `fetch`, checks `res.ok`,
  returns errors instead of throwing for one bad address).
- `loan-reminders`: `rpc('get_due_loan_reminders')`, group rows per user, one e-mail per user per day,
  skip users already logged today in `email_reports_log` (`report_type = 'loan_reminder'`), wording by
  `direction` ("Vikram owes you ₹3,000" vs "You owe HDFC ₹10,000"), show `outstanding`, escape all user text,
  link to `${APP_URL}/dashboard/loans`.
- `monthly-report`: `rpc('get_report_recipients')`; for each user the previous month in their timezone;
  read `category_periods` (+ categories) and `transactions` for that month with the service client filtered
  by `user_id`; skip if `email_reports_log` already has the monthly row (unique index
  `uq_email_reports_monthly`); insert the log row only after a successful send. Content: spent vs budget,
  top categories, overspent categories, money rolled into stacks (`accrued_amount`), savings rate.
  The original file also declares `getMonthName` twice (SyntaxError at deploy).
- `open-periods`, `close-periods`: keep as thin legacy aliases that call `rpc('sync_all_periods')`
  behind the auth guard.
- Make the folder lint-clean (no `any`, unused `req`).

### Task 12: Docs and verification

- Rewrite `README.md`: features, Supabase setup (migrations 001→005, auth URLs, Vault + cron, functions
  deploy), env vars, scripts, architecture, DB test harness.
- Add `.env.example` and `!.env.example` to `.gitignore` (today `.env*` would ignore it).
- Run `npm run lint`, `npm run typecheck`, `npm run build`, smoke test with `next start`.
- With the owner's `.env`: register → confirm e-mail → onboarding (each preset) → dashboard; add / edit /
  delete expenses; recurring rule posting; month switcher; move money to all four destinations; goals
  add / withdraw / fund; loans with partial repayments, delete repayment, reminders; settings: profile,
  timezone, reorder, sub-categories, archive/restore, groups; password reset link; sign out.

### Task 13: Finish

- Commit, push, open a PR from `upgrade/ledger-overhaul` into `main` (summary, testing, SQL to run).
- Remind the owner to revoke the GitHub token that was pasted in chat and create a new one if needed.

## Decisions and conventions

- Money is INR, numbers rounded to 2 decimals; `formatCurrency` shows paise only when present.
- Dates are `YYYY-MM-DD` strings; "today" is computed in the profile timezone on the server and passed
  down (no client-side clock reads during render, so no hydration mismatch).
- Categories are archived, never deleted (stack money and history must survive).
- Every Server Action returns `ActionResult` (`{ success, data | error }`) and re-validates input.
- Reads live in `lib/data` (`server-only`); client components only receive serialisable props.
- UI keeps the original identity (dark navy, brass, teal, IBM Plex); modals are native `<dialog>`
  (focus trap, Esc, bottom sheet on phones); toasts use `aria-live`; reduced-motion respected.

## How to resume

```bash
git fetch origin && git checkout upgrade/ledger-overhaul
npm ci
npx tsc --noEmit
npx eslint app components lib proxy.ts next.config.ts
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy npx next build
# Database tests: see the header of supabase/tests/migration-005/run.sh (needs Docker)
# Regenerate types after schema changes: see the header of types/database.ts
```

Notes for an AI agent continuing here: read `AGENTS.md` (Next 16 docs live in `node_modules/next/dist/docs`).
In the original dev environment, heredocs / multi-line inline scripts in the terminal could hang and helper
scripts under `/tmp` were cleaned up, so keep helper files inside the repo or use file-editing tools.
