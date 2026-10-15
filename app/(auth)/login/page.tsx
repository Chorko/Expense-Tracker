import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'
import { AUTH_ERRORS, safeNextPath } from '@/lib/auth-redirect'

export const metadata: Metadata = { title: 'Sign in' }

type SearchParams = Promise<{ next?: string | string[]; error?: string | string[]; reset?: string | string[] }>

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const error = typeof params.error === 'string' ? AUTH_ERRORS[params.error] ?? null : null
  return (
    <LoginForm
      next={safeNextPath(params.next)}
      initialError={error}
      notice={params.reset === 'done' ? 'Your password has been updated. Sign in with the new one.' : null}
    />
  )
}
