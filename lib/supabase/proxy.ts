import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv, isSupabaseConfigured } from '@/lib/env'
import type { Database } from '@/types/database'

// Pages that need a signed-in user
const PROTECTED = ['/dashboard', '/onboarding', '/reset-password']
// Pages that only make sense when signed out
const GUEST_ONLY = ['/login', '/register', '/forgot-password']

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
  params: Record<string, string> = {}
) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const redirect = NextResponse.redirect(url)
  // Keep any refreshed auth cookies, otherwise the user is signed out again
  from.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'cache-control' || key.toLowerCase() === 'expires' || key.toLowerCase() === 'pragma') {
      redirect.headers.set(key, value)
    }
  })
  return redirect
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  // Without configuration let the request through; pages show a clear error
  if (!isSupabaseConfigured()) return response

  const { url, key } = getSupabaseEnv()
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        // Responses that set auth cookies must never be cached by a CDN
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value))
      },
    },
  })

  // Verifies the JWT and refreshes an expiring session. Keep this call
  // directly after creating the client.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  if (!signedIn && matches(pathname, PROTECTED)) {
    return redirectKeepingCookies(request, response, '/login', { next: `${pathname}${search}` })
  }
  if (signedIn && matches(pathname, GUEST_ONLY)) {
    return redirectKeepingCookies(request, response, '/dashboard')
  }
  return response
}
