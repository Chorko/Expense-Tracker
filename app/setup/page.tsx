import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Finish setup' }

const MIGRATIONS = [
  '001_initial_schema.sql',
  '002_functions_and_cron.sql',
  '003_subcategories_and_borrowed_loans.sql',
  '004_fix_missing_profiles_and_sync_trigger.sql',
  '005_hardening_sync_and_features.sql',
]

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
  const { reason } = await searchParams
  const isEnv = reason === 'env'

  return (
    <div className="auth-container">
      <div className="auth-card animate-fadeIn" style={{ maxWidth: 560 }}>
        <p className="eyebrow mb-2">Almost there</p>
        <h1 className="text-xl font-semibold text-parchment">
          {isEnv ? 'Connect your Supabase project' : 'Update your database'}
        </h1>

        {isEnv ? (
          <div className="mt-4 space-y-3 text-sm text-parchment-dim">
            <p>
              Ledger needs your Supabase project URL and publishable key. Create <code>.env.local</code> in the project
              root (see <code>.env.example</code>):
            </p>
            <pre className="surface overflow-x-auto p-3 font-mono text-xs text-parchment">
              {`NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
            </pre>
            <p>
              Both values are under <strong>Project Settings → API Keys</strong>. The legacy{' '}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> also works. Restart the dev server afterwards.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-parchment-dim">
            <p>
              The app expects the latest schema. In the Supabase dashboard open <strong>SQL Editor</strong> and run any of
              these files from <code>supabase/migrations</code> that you have not run yet, in order:
            </p>
            <ol className="surface list-decimal space-y-1 p-3 pl-8 font-mono text-xs text-parchment">
              {MIGRATIONS.map(file => (
                <li key={file}>{file}</li>
              ))}
            </ol>
            <p>Migration 005 is safe to run more than once. Reload this app when it finishes.</p>
          </div>
        )}

        <Link href="/dashboard" className="btn btn-primary mt-6 w-full">
          I have done this, continue
        </Link>
      </div>
    </div>
  )
}
