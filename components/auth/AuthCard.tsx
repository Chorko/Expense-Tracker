import Link from 'next/link'

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="auth-container">
      <main id="main-content" className="auth-card animate-fadeIn" style={wide ? { maxWidth: 460 } : undefined}>
        <div className="mb-7 text-center">
          <Link
            href="/"
            className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl font-bold text-ink-navy"
            style={{ background: 'linear-gradient(135deg, var(--brass-light), var(--brass-dark))' }}
            aria-label="Ledger home"
          >
            ₹
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-parchment">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-parchment-dim">{subtitle}</p>}
        </div>
        {children}
        {footer && (
          <>
            <hr className="divider" />
            <div className="text-center text-sm text-parchment-dim">{footer}</div>
          </>
        )}
      </main>
    </div>
  )
}

/** Maps Supabase Auth errors to friendly, non-revealing messages. */
export function authErrorMessage(error: { message?: string; code?: string; status?: number } | null): string {
  const message = error?.message ?? ''
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.'
  if (/email not confirmed/i.test(message)) return 'Please confirm your e-mail first. Check your inbox for the link.'
  if (/rate limit|too many/i.test(message) || error?.status === 429) return 'Too many attempts. Please wait a minute and try again.'
  if (/password should be|weak password/i.test(message)) return 'Choose a stronger password.'
  if (/fetch|network/i.test(message)) return 'Could not reach the server. Check your connection.'
  return 'Something went wrong. Please try again.'
}
