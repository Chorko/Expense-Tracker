'use client'

import Link from 'next/link'
import { useId, useState, useTransition } from 'react'
import { AuthCard, authErrorMessage } from '@/components/auth/AuthCard'
import { Field } from '@/components/ui/primitives'
import { createClient } from '@/lib/supabase/client'
import { emailOnlySchema } from '@/lib/validations'

export default function ForgotPasswordPage() {
  const id = useId()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = emailOnlySchema.safeParse({ email })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter a valid email address')
    setError('')
    startTransition(async () => {
      try {
        const { error: resetError } = await createClient().auth.resetPasswordForEmail(parsed.data.email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        })
        // Rate limits are worth reporting; anything else is answered the
        // same way so the form cannot be used to probe for accounts
        if (resetError && (resetError.status === 429 || /rate limit/i.test(resetError.message))) {
          return setError(authErrorMessage(resetError))
        }
        setSent(true)
      } catch (cause) {
        setError(cause instanceof Error && /not configured/i.test(cause.message) ? cause.message : authErrorMessage(null))
      }
    })
  }

  return (
    <AuthCard
      title={sent ? 'Check your inbox' : 'Reset your password'}
      subtitle={sent ? undefined : 'We will e-mail you a link to choose a new one'}
      footer={
        <Link href="/login" className="font-medium text-brass hover:text-brass-light">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="form-success" role="status">
          If an account exists for {email}, a reset link is on its way. The link works once and expires after an hour.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field id={`${id}-email`} label="Email" error={error}>
            <input
              id={`${id}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={Boolean(error) || undefined}
              disabled={pending}
              autoFocus
            />
          </Field>
          <button type="submit" className="btn btn-primary w-full" disabled={pending}>
            {pending && <span className="spinner" aria-hidden="true" />}
            Send reset link
          </button>
        </form>
      )}
    </AuthCard>
  )
}
