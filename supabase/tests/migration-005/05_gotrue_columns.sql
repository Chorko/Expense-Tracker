-- GoTrue adds these at runtime on hosted Supabase; the bare image lacks them
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
