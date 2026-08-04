'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registerSchema } from '@/lib/validations'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    display_name: '',
    email: '',
    password: '',
    confirm_password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')

    const parsed = registerSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const err of parsed.error.issues) {
        fieldErrors[err.path[0] as string] = err.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})

    startTransition(async () => {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { display_name: parsed.data.display_name },
        },
      })

      if (error) {
        setServerError(error.message ?? 'Registration failed. Please try again.')
        return
      }

      // Redirect to onboarding after sign-up
      router.push('/onboarding')
    })
  }

  const passwordStrength = (() => {
    const p = form.password
    if (!p) return 0
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  })()

  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['', '#ef4444', '#f59e0b', '#22c55e', '#2dd4bf']

  return (
    <div className="auth-container">
      <div className="auth-card animate-fadeIn" style={{ maxWidth: '440px' }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal/10 border border-teal/20 mb-4">
            <span className="text-2xl">₹</span>
          </div>
          <h1 className="text-2xl font-bold text-parchment tracking-tight">Create Account</h1>
          <p className="text-parchment-dim text-sm mt-1">Start tracking your finances</p>
        </div>

        {serverError && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm animate-fadeIn">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="on" id="register-form">
          {/* Username / Display Name */}
          <div className="mb-4">
            <label htmlFor="reg-username" className="input-label">Username</label>
            <input
              id="reg-username"
              type="text"
              name="username"
              autoComplete="username"
              value={form.display_name}
              onChange={e => update('display_name', e.target.value)}
              className={`input ${errors.display_name ? 'input-error' : ''}`}
              placeholder="Choc"
              disabled={isPending}
              maxLength={50}
            />
            {errors.display_name && <p className="input-error-msg">{errors.display_name}</p>}
          </div>

          {/* Email */}
          <div className="mb-4">
            <label htmlFor="reg-email" className="input-label">Email</label>
            <input
              id="reg-email"
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              className={`input ${errors.email ? 'input-error' : ''}`}
              placeholder="you@example.com"
              disabled={isPending}
            />
            {errors.email && <p className="input-error-msg">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="mb-2">
            <label htmlFor="reg-password" className="input-label">Password</label>
            <input
              id="reg-password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              className={`input ${errors.password ? 'input-error' : ''}`}
              placeholder="Min. 8 chars, 1 uppercase, 1 number"
              disabled={isPending}
              maxLength={128}
            />
            {errors.password && <p className="input-error-msg">{errors.password}</p>}
          </div>

          {/* Password strength meter */}
          {form.password && (
            <div className="mb-4">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: i <= passwordStrength ? strengthColors[passwordStrength] : 'var(--ink-navy-4)',
                    }}
                  />
                ))}
              </div>
              <p className="text-xs" style={{ color: strengthColors[passwordStrength] }}>
                {strengthLabels[passwordStrength]}
              </p>
            </div>
          )}

          {/* Confirm Password */}
          <div className="mb-6">
            <label htmlFor="reg-confirm" className="input-label">Confirm Password</label>
            <input
              id="reg-confirm"
              type="password"
              name="confirm_password"
              autoComplete="new-password"
              value={form.confirm_password}
              onChange={e => update('confirm_password', e.target.value)}
              className={`input ${errors.confirm_password ? 'input-error' : ''}`}
              placeholder="••••••••"
              disabled={isPending}
            />
            {errors.confirm_password && (
              <p className="input-error-msg">{errors.confirm_password}</p>
            )}
          </div>

          <button
            id="register-submit"
            type="submit"
            className="btn btn-teal w-full"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-ink-navy/30 border-t-ink-navy rounded-full animate-spin" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <div className="divider" />

        <p className="text-center text-sm text-parchment-dim">
          Already have an account?{' '}
          <Link href="/login" className="text-brass hover:text-brass-light transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
