'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { AuthCard, authErrorMessage } from '@/components/auth/AuthCard'
import { Field } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { newPasswordSchema } from '@/lib/validations'

export function ResetPasswordForm({ email }: { email: string }) {
  const id = useId()
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm_password?: string }>({})
  const [error, setError] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = newPasswordSchema.safeParse({ password, confirm_password: confirm })
    if (!parsed.success) {
      const next: typeof errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof errors
        next[key] ??= issue.message
      }
      return setErrors(next)
    }
    setErrors({})
    setError('')
    startTransition(async () => {
      const { error: updateError } = await createClient().auth.updateUser({ password: parsed.data.password })
      if (updateError) {
        return setError(
          /same|different from the old/i.test(updateError.message)
            ? 'Choose a password you have not used before.'
            : authErrorMessage(updateError)
        )
      }
      toast.success('Password updated')
      router.replace('/dashboard')
      router.refresh()
    })
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle={email ? `For ${email}` : undefined}
      footer={
        <Link href="/dashboard" className="text-parchment-dim hover:text-parchment">
          Cancel
        </Link>
      }
    >
      {error && (
        <p className="form-error mb-4" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {/* Helps password managers store the new password for the right account */}
        <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
        <Field
          id={`${id}-password`}
          label="New password"
          error={errors.password}
          hint="At least 8 characters with upper- and lower-case letters and a number."
        >
          <input
            id={`${id}-password`}
            type="password"
            autoComplete="new-password"
            className="input"
            value={password}
            maxLength={128}
            onChange={e => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password) || undefined}
            disabled={pending}
            autoFocus
          />
        </Field>
        <Field id={`${id}-confirm`} label="Confirm new password" error={errors.confirm_password}>
          <input
            id={`${id}-confirm`}
            type="password"
            autoComplete="new-password"
            className="input"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            aria-invalid={Boolean(errors.confirm_password) || undefined}
            disabled={pending}
          />
        </Field>
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          Save new password
        </button>
      </form>
    </AuthCard>
  )
}
