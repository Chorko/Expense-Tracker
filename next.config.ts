import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

// Allow the configured Supabase project (custom domains and local
// `supabase start` included) plus hosted *.supabase.co for REST + realtime.
function supabaseOrigins(): string[] {
  const origins = new Set(['https://*.supabase.co', 'wss://*.supabase.co'])
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (configured) {
    try {
      const url = new URL(configured)
      origins.add(url.origin)
      origins.add(`${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`)
    } catch {
      // Invalid URL: the app reports it at runtime
    }
  }
  return [...origins]
}

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js inlines bootstrap scripts; eval is only needed by the dev overlay
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${supabaseOrigins().join(' ')}${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: '/(.*)', headers: securityHeaders }],
}

export default nextConfig
