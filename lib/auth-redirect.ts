/**
 * Returns `value` only if it is a same-site path ("/dashboard?x=1").
 * Anything else ("//evil.com", "https://evil.com", "/\\evil.com") falls back
 * to the default, so ?next= can never be used as an open redirect.
 */
export function safeNextPath(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    const parsed = new URL(value, 'http://localhost')
    if (parsed.origin !== 'http://localhost') return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

/** Friendly copy for ?error= codes used by the auth pages. */
export const AUTH_ERRORS: Record<string, string> = {
  link_expired: 'That link has expired or was already used. Request a new one below.',
  auth_callback_failed: 'We could not sign you in from that link. Please try again.',
  session_required: 'Please sign in to continue.',
}
