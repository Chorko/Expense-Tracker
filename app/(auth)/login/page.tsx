'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations'
import type { Metadata } from 'next'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')

    const parsed = loginSchema.safeParse({ email, password })
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
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      })

      if (error) {
        setServerError(
          error.message === 'Invalid login credentials'
            ? 'Incorrect email or password. Please try again.'
            : 'Sign in failed. Please try again.'
        )
        return
      }

      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-fadeIn">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brass/10 border border-brass/20 mb-4">
            <span className="text-2xl">₹</span>
          </div>
          <h1 className="text-2xl font-bold text-parchment tracking-tight">Ledger</h1>
          <p className="text-parchment-dim text-sm mt-1">Sign in to your account</p>
        </div>

        {serverError && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm animate-fadeIn">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="on" id="login-form">
          <div className="mb-4">
            <label htmlFor="login-email" className="input-label">Email</label>
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={`input ${errors.email ? 'input-error' : ''}`}
              placeholder="you@example.com"
              disabled={isPending}
            />
            {errors.email && <p className="input-error-msg">{errors.email}</p>}
          </div>

          <div className="mb-6">
            <label htmlFor="login-password" className="input-label">Password</label>
            <input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`input ${errors.password ? 'input-error' : ''}`}
              placeholder="••••••••"
              disabled={isPending}
            />
            {errors.password && <p className="input-error-msg">{errors.password}</p>}
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary w-full"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-ink-navy/30 border-t-ink-navy rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="divider" />

        <p className="text-center text-sm text-parchment-dim">
          New here?{' '}
          <Link href="/register" className="text-brass hover:text-brass-light transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
