'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { AuthCard, authErrorMessage } from '@/components/auth/AuthCard'
import { Field } from '@/components/ui/primitives'
import { createClient } from '@/lib/supabase/client'
import { registerSchema } from '@/lib/validations'

type Form = { display_name: string; email: string; password: string; confirm_password: string }

const STRENGTH = [
  { label: '', color: 'var(--ink-navy-4)' },
  { label: 'Weak', color: 'var(--danger)' },
  { label: 'Fair', color: 'var(--warning)' },
  { label: 'Good', color: 'var(--success)' },
  { label: 'Strong', color: 'var(--teal)' },
]

function strength(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 14) score++
  return score
}

function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
}

export function RegisterForm() {
  const id = useId()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<Form>({ display_name: '', email: '', password: '', confirm_password: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const score = strength(form.password)

  function update(field: keyof Form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (fieldErrors[field]) setFieldErrors(e => ({ ...e, [field]: undefined }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = registerSchema.safeParse(form)
    if (!parsed.success) {
      const errors: Partial<Record<keyof Form, string>> = {}
      for (const issue of parsed.error.issues) errors[issue.path[0] as keyof Form] ??= issue.message
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setError('')

    startTransition(async () => {
      try {
        const { data, error: signUpError } = await createClient().auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            data: { display_name: parsed.data.display_name },
            emailRedirectTo: callbackUrl('/onboarding'),
          },
        })
        if (signUpError) return setError(authErrorMessage(signUpError))
        if (data.session) {
          router.replace('/onboarding')
          router.refresh()
          return
        }
        // E-mail confirmation is on (or the address is already registered:
        // Supabase answers the same way so accounts cannot be enumerated)
        setSentTo(parsed.data.email)
      } catch (cause) {
        setError(cause instanceof Error && /not configured/i.test(cause.message) ? cause.message : authErrorMessage(null))
      }
    })
  }

  function resend() {
    if (!sentTo) return
    startTransition(async () => {
      const { error: resendError } = await createClient().auth.resend({
        type: 'signup',
        email: sentTo,
        options: { emailRedirectTo: callbackUrl('/onboarding') },
      })
      if (resendError) return setError(authErrorMessage(resendError))
      setResent(true)
    })
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your inbox" subtitle={`We sent a confirmation link to ${sentTo}`}>
        <p className="text-sm text-parchment-dim">
          Open the link on this device to finish creating your account. It can take a minute to arrive; check spam too.
        </p>
        {error && (
          <p className="form-error mt-4" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" className="btn btn-outline w-full" onClick={resend} disabled={pending || resent}>
            {resent ? 'Sent again ✓' : 'Resend the e-mail'}
          </button>
          <Link href="/login" className="btn btn-ghost w-full">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      wide
      title="Create your Ledger"
      subtitle="Budgets that roll over, so unspent money is never lost"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brass hover:text-brass-light">
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <p className="form-error mb-4" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field id={`${id}-name`} label="Your name" error={fieldErrors.display_name}>
          <input
            id={`${id}-name`}
            className="input"
            autoComplete="name"
            value={form.display_name}
            maxLength={100}
            onChange={e => update('display_name', e.target.value)}
            aria-invalid={Boolean(fieldErrors.display_name) || undefined}
            disabled={pending}
            autoFocus
          />
        </Field>
        <Field id={`${id}-email`} label="Email" error={fieldErrors.email}>
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            className="input"
            value={form.email}
            onChange={e => update('email', e.target.value)}
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email) || undefined}
            disabled={pending}
          />
        </Field>
        <Field
          id={`${id}-password`}
          label="Password"
          error={fieldErrors.password}
          hint="At least 8 characters with upper- and lower-case letters and a number."
        >
          <input
            id={`${id}-password`}
            type="password"
            autoComplete="new-password"
            className="input"
            value={form.password}
            maxLength={128}
            onChange={e => update('password', e.target.value)}
            aria-invalid={Boolean(fieldErrors.password) || undefined}
            aria-describedby={`${id}-strength`}
            disabled={pending}
          />
        </Field>
        {form.password && (
          <div id={`${id}-strength`} aria-live="polite" className="-mt-2">
            <div className="mb-1 flex gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map(level => (
                <span
                  key={level}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{ background: level <= score ? STRENGTH[score].color : 'var(--ink-navy-4)' }}
                />
              ))}
            </div>
            <p className="text-xs" style={{ color: STRENGTH[score].color }}>
              Strength: {STRENGTH[score].label || 'too short'}
            </p>
          </div>
        )}
        <Field id={`${id}-confirm`} label="Confirm password" error={fieldErrors.confirm_password}>
          <input
            id={`${id}-confirm`}
            type="password"
            autoComplete="new-password"
            className="input"
            value={form.confirm_password}
            onChange={e => update('confirm_password', e.target.value)}
            aria-invalid={Boolean(fieldErrors.confirm_password) || undefined}
            disabled={pending}
          />
        </Field>
        <button type="submit" className="btn btn-teal w-full" disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  )
}
