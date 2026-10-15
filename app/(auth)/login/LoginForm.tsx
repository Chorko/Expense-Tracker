'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { AuthCard, authErrorMessage } from '@/components/auth/AuthCard'
import { Field } from '@/components/ui/primitives'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations'

export function LoginForm({ next, initialError, notice }: { next: string; initialError: string | null; notice: string | null }) {
  const id = useId()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState(initialError ?? '')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setError('')

    startTransition(async () => {
      try {
        const { error: signInError } = await createClient().auth.signInWithPassword(parsed.data)
        if (signInError) return setError(authErrorMessage(signInError))
        router.replace(next)
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error && /not configured/i.test(cause.message) ? cause.message : authErrorMessage(null))
      }
    })
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your Ledger"
      footer={
        <>
          New here?{' '}
          <Link href="/register" className="font-medium text-brass hover:text-brass-light">
            Create an account
          </Link>
        </>
      }
    >
      {notice && (
        <p className="form-success mb-4" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error mb-4" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field id={`${id}-email`} label="Email" error={fieldErrors.email}>
          <input
            id={`${id}-email`}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            className="input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email) || undefined}
            disabled={pending}
            autoFocus
          />
        </Field>
        <Field id={`${id}-password`} label="Password" error={fieldErrors.password}>
          <input
            id={`${id}-password`}
            type="password"
            name="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password) || undefined}
            disabled={pending}
          />
        </Field>
        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="text-xs text-parchment-dim hover:text-brass">
            Forgot your password?
          </Link>
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  )
}
