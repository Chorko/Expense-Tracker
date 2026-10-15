import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/auth-redirect'

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

/**
 * Lands e-mail links (sign-up confirmation, password recovery, magic links).
 * Supports both the PKCE `code` flow and `token_hash` links from custom
 * e-mail templates. Redirects only to same-site paths.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const next = safeNextPath(searchParams.get('next'))
  const failure = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, request.url))

  // Supabase forwards errors such as expired links as query parameters
  if (searchParams.get('error') || searchParams.get('error_code')) {
    return failure('link_expired')
  }

  const supabase = await createClient()
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return failure('link_expired')
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return failure('link_expired')
  } else {
    return failure('auth_callback_failed')
  }

  // Recovery links always lead to the new-password form
  const destination = type === 'recovery' ? '/reset-password' : next
  return NextResponse.redirect(new URL(destination, request.url))
}
