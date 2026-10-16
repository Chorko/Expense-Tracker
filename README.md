# Ledger

A personal finance tracker built around **envelope budgeting with rollover stacks**: give each category a
monthly budget, and whatever you do not spend is saved into that category's "stack" at month end instead of
disappearing. Move stack money into next month's budget, another category, a savings goal, or record it as an
investment.

Built with Next.js 16 (App Router) and Supabase (Postgres, Auth, Edge Functions).

## Features

- **Budgets with rollover stacks** — monthly budget per category, unspent money accrues to a per-category
  stack, with a full audited history of every movement.
- **Sub-categories and groups** — one level of sub-categories; colour-coded groups.
- **Transactions** — add/edit/delete, month navigation, search and filters, day-grouped list, CSV export.
- **Recurring expenses** — daily/weekly/monthly/yearly rules that post automatically (with catch-up).
- **Savings goals** — fund them from stacks or record money saved elsewhere.
- **Lending tracker** — money you lent and money you borrowed, partial repayments, e-mail reminders.
- **Investments** — record stock/fund purchases paid for from your stacks, with a funding receipt.
- **Dashboard** — spend vs budget, daily allowance, spending donut, 6-month trend, a daily calendar.
- **Monthly e-mail report** and **loan reminders** via Supabase Edge Functions + Resend.
- Timezone-aware months, dark responsive UI, accessible dialogs and toasts.

## Tech stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, `proxy.ts`) |
| Language | TypeScript, React 19 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Backend | Supabase — Postgres + RLS, Auth, Edge Functions (Deno) |
| Validation | Zod |

## Prerequisites

- Node.js 20.9+ (Next.js 16 requirement)
- A Supabase project
- Optional, for e-mails: a [Resend](https://resend.com) API key
- Optional, for the DB test harness: Docker

## Setup

### 1. Install

```bash
npm install
```

### 2. Database

In the Supabase dashboard → **SQL Editor**, run the migrations in order (each only once, except 005 which is
safe to re-run):

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_functions_and_cron.sql
supabase/migrations/003_subcategories_and_borrowed_loans.sql
supabase/migrations/004_fix_missing_profiles_and_sync_trigger.sql
supabase/migrations/005_hardening_sync_and_features.sql   ← required by this version
```

Migration 005 hardens security, keeps budgets in sync, rolls months over per timezone, and adds goal funding,
recurring posting and fixed cron jobs. The app redirects to `/setup` until it has been run.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in from Supabase → **Project Settings → API keys**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

(The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works.)

### 4. Auth redirect URLs

Supabase → **Authentication → URL Configuration**:

- **Site URL**: your app URL (e.g. `http://localhost:3000` for development).
- **Redirect URLs**: add `<site-url>/auth/callback`.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000, register, confirm your e-mail (if confirmations are on), and the onboarding flow
sets up your first budget.

## E-mail reports and reminders (optional)

Two Edge Functions send e-mail: `loan-reminders` (daily) and `monthly-report` (early each month). The budget
engine itself runs **inside Postgres** and needs no functions.

1. Enable the `pg_cron` and `pg_net` extensions (Supabase → Database → Extensions).
2. Store secrets for the cron jobs (SQL Editor, once):

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<your secret or service_role key>',  'service_key');
   ```

   Migration 005 schedules the jobs; they call the functions with this key in the `apikey` header.
3. Deploy the functions (they verify the key themselves, so skip the platform JWT check):

   ```bash
   supabase functions deploy loan-reminders --no-verify-jwt
   supabase functions deploy monthly-report --no-verify-jwt
   # legacy aliases, only if you still schedule them:
   supabase functions deploy open-periods  --no-verify-jwt
   supabase functions deploy close-periods --no-verify-jwt
   ```
4. Set the function secrets (not in `.env.local`):

   ```bash
   supabase secrets set RESEND_API_KEY=re_... \
     "RESEND_FROM_EMAIL=Ledger <you@yourdomain.com>" \
     APP_URL=https://your-app-url
   ```

   `SUPABASE_URL` and the secret key are injected by the platform.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |

## Architecture

```
proxy.ts                 Next 16 proxy (was middleware): verifies the session, guards routes
app/(auth)/*             login, register, forgot-password
app/auth/callback        e-mail link handler (PKCE + token_hash)
app/reset-password       set a new password
app/onboarding           first-run budget setup (presets)
app/setup                shown until the env / migration 005 is in place
app/dashboard/*          overview, transactions, stacks, goals, loans, investments, settings
app/actions/*            Server Actions (Zod-validated, RLS-scoped)
lib/data/*               server-only data access (React cache); getViewer() syncs budget months
lib/*                    budget maths, dates (timezone-aware), formatting, validation, presets
components/*              UI primitives (native <dialog> modals, toasts) and feature components
supabase/migrations/*    database schema and the budget engine
supabase/functions/*     Deno Edge Functions for the e-mails
supabase/tests/*         Docker harness that runs the migrations and checks them
types/database.ts        generated Supabase types
```

**Budget model**: each category → one `category_periods` row per month → unused budget accrues to
`category_stacks` when the month closes (logged in `stack_transactions`). Stack money is moved with the
`move_stack_money()` database function. All ledger tables are read-only to clients; every write goes through
audited, `auth.uid()`-scoped functions under Row Level Security.

## Database tests

With Docker available, the migrations are checked against Supabase's own Postgres image:

```bash
docker run -d --rm --name ledger-db-test -e POSTGRES_PASSWORD=postgres supabase/postgres:17.11.0.004
sleep 25
docker cp supabase/tests/migration-005 ledger-db-test:/t
docker cp supabase/migrations ledger-db-test:/m
docker exec ledger-db-test sh /t/run.sh      # ~112 checks, ends with "ALL OK"
docker rm -f ledger-db-test
```

## Regenerating types after a schema change

```bash
npx supabase gen types typescript --project-id <project-ref> --schema public > types/database.ts
```

See `docs/UPGRADE_PLAN.md` for the full history of this rewrite and the design decisions behind it.
