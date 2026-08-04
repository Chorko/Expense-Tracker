'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile, createCategory } from '@/app/actions/categories'

const DEFAULT_CATEGORIES = [
  { name: 'Rent', icon: '🏠', amount: 9500 },
  { name: 'Food', icon: '🍽️', amount: 5000 },
  { name: 'Grocery', icon: '🛒', amount: 500 },
  { name: 'Subscriptions', icon: '📱', amount: 1500 },
  { name: 'Chennai travel', icon: '🚌', amount: 2000 },
  { name: 'Domestic travel', icon: '✈️', amount: 500 },
  { name: 'Family support', icon: '👨‍👩‍👧', amount: 4000 },
  { name: 'Church', icon: '⛪', amount: 1000 },
  { name: "Parents' health insurance", icon: '🏥', amount: 3000 },
  { name: 'Term insurance (yourself)', icon: '🛡️', amount: 300 },
  { name: 'OPD / routine medical buffer', icon: '💊', amount: 350 },
  { name: 'SIP — Nifty 50 (core)', icon: '📈', amount: 3520 },
  { name: 'SIP — Nifty Next 50', icon: '📊', amount: 1280 },
  { name: 'SIP — Nasdaq 100 FoF', icon: '🌐', amount: 1600 },
  { name: 'Personal RD @ 7.25%', icon: '🏦', amount: 3450 },
  { name: 'Growth — SIP/Bond (fund TBD)', icon: '🌱', amount: 250 },
  { name: 'EF safety top-up (→ liquid fund)', icon: '🛟', amount: 500 },
  { name: 'Entertainment', icon: '🎬', amount: 2000 },
  { name: 'Shopping', icon: '🛍️', amount: 1500 },
  { name: 'Misc', icon: '📦', amount: 1000 },
  { name: 'Annual one-off sinking fund (→ Oct RD)', icon: '🏺', amount: 1250 },
  { name: 'Gifts sinking fund', icon: '🎁', amount: 1000 },
]

type CategoryDraft = { name: string; icon: string; amount: number; enabled: boolean }

export default function OnboardingPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1: income
  const [displayName, setDisplayName] = useState('')
  const [income, setIncome] = useState('')
  const [step1Error, setStep1Error] = useState('')

  // Step 2: categories
  const [cats, setCats] = useState<CategoryDraft[]>(
    DEFAULT_CATEGORIES.map(c => ({ ...c, enabled: true }))
  )

  function toggleCat(i: number) {
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, enabled: !c.enabled } : c))
  }

  function updateAmount(i: number, val: string) {
    const num = parseFloat(val)
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, amount: isNaN(num) ? 0 : num } : c))
  }

  function goToStep2() {
    if (!income || isNaN(Number(income)) || Number(income) < 0) {
      setStep1Error('Please enter a valid income')
      return
    }
    setStep1Error('')
    setStep(2)
  }

  function handleFinish() {
    startTransition(async () => {
      // Update profile income
      await updateProfile({
        monthly_income: Number(income),
        display_name: displayName.trim() || undefined,
      })

      // Create enabled categories
      const enabled = cats.filter(c => c.enabled)
      await Promise.all(
        enabled.map(c =>
          createCategory({
            name: c.name,
            icon: c.icon,
            monthly_budget_amount: c.amount,
            is_flexible: false,
          })
        )
      )

      router.push('/dashboard')
    })
  }

  return (
    <div className="auth-container">
      <div
        className="animate-fadeIn"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--ink-navy-2)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          padding: '2rem',
        }}
      >
        {/* Steps indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2].map(s => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={{
                backgroundColor: s <= step ? 'var(--brass)' : 'var(--ink-navy-4)',
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="animate-fadeIn">
            <h1 className="text-2xl font-bold text-parchment mb-1">Welcome to Ledger 👋</h1>
            <p className="text-parchment-dim text-sm mb-8">Let&apos;s set up your financial profile</p>

            <div className="mb-4">
              <label htmlFor="onboard-name" className="input-label">Your name / username</label>
              <input
                id="onboard-name"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="input"
                placeholder="Choc"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="onboard-income" className="input-label">Monthly income (₹)</label>
              <input
                id="onboard-income"
                type="number"
                value={income}
                onChange={e => setIncome(e.target.value)}
                className={`input font-mono ${step1Error ? 'input-error' : ''}`}
                placeholder="50000"
                min="0"
              />
              {step1Error && <p className="input-error-msg">{step1Error}</p>}
              <p className="text-xs text-parchment-faint mt-1">Used to compute savings rate on your dashboard</p>
            </div>

            <button id="onboard-next" className="btn btn-primary w-full" onClick={goToStep2}>
              Continue →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fadeIn">
            <h2 className="text-xl font-bold text-parchment mb-1">Set your budget categories</h2>
            <p className="text-parchment-dim text-sm mb-6">
              Toggle and edit amounts — you can change these any time
            </p>

            <div className="flex flex-col gap-2 mb-6 max-h-96 overflow-y-auto pr-1">
              {cats.map((cat, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg transition-all"
                  style={{
                    background: cat.enabled ? 'var(--ink-navy-3)' : 'var(--ink-navy)',
                    border: cat.enabled
                      ? '1px solid rgba(201,168,76,0.15)'
                      : '1px solid rgba(255,255,255,0.04)',
                    opacity: cat.enabled ? 1 : 0.5,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleCat(i)}
                    className="flex-shrink-0 w-5 h-5 rounded border-2 transition-all flex items-center justify-center"
                    style={{
                      borderColor: cat.enabled ? 'var(--brass)' : 'var(--parchment-faint)',
                      background: cat.enabled ? 'var(--brass)' : 'transparent',
                    }}
                    aria-label={`Toggle ${cat.name}`}
                  >
                    {cat.enabled && <span className="text-ink-navy text-xs font-bold">✓</span>}
                  </button>
                  <span className="text-xl flex-shrink-0">{cat.icon}</span>
                  <span className="flex-1 text-sm text-parchment font-medium">{cat.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-parchment-faint text-sm font-mono">₹</span>
                    <input
                      type="number"
                      value={cat.amount}
                      onChange={e => updateAmount(i, e.target.value)}
                      disabled={!cat.enabled}
                      className="input font-mono text-right"
                      style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                      min="0"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              className="p-3 rounded-lg mb-6 text-sm"
              style={{
                background: 'rgba(45,212,191,0.06)',
                border: '1px solid rgba(45,212,191,0.15)',
                color: 'var(--teal)',
              }}
            >
              Total budget: ₹{cats.filter(c => c.enabled).reduce((s, c) => s + c.amount, 0).toLocaleString('en-IN')} / month
            </div>

            <div className="flex gap-3">
              <button id="onboard-back" className="btn btn-ghost flex-1" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                id="onboard-finish"
                className="btn btn-primary flex-2"
                style={{ flex: 2 }}
                onClick={handleFinish}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-ink-navy/30 border-t-ink-navy rounded-full animate-spin" />
                    Setting up…
                  </>
                ) : (
                  'Launch my dashboard →'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
