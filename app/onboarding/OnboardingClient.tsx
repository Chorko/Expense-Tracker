'use client'

import { useId, useState, useTransition } from 'react'
import { completeOnboarding } from '@/app/actions/profile'
import { AmountInput } from '@/components/ui/AmountInput'
import { Field } from '@/components/ui/primitives'
import { BUDGET_PRESETS, presetAmount, type PresetGroup } from '@/lib/presets'
import { amountToInput, formatCurrency, parseAmount, roundMoney } from '@/lib/format'

type OnboardingClientProps = {
  defaultName: string
  defaultIncome: number
  timezone: string
  timezones: string[]
}

type Row = { key: string; enabled: boolean; name: string; icon: string; amount: string; group_key: string | null }

const STEPS = ['About you', 'Starting point', 'Your budget']

export function OnboardingClient({ defaultName, defaultIncome, timezone: initialTz, timezones }: OnboardingClientProps) {
  const id = useId()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(defaultName)
  const [income, setIncome] = useState(defaultIncome > 0 ? amountToInput(defaultIncome) : '')
  const [timezone, setTimezone] = useState(initialTz)
  const [presetId, setPresetId] = useState<string>('starter')
  const [groups, setGroups] = useState<PresetGroup[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  const incomeValue = parseAmount(income) ?? 0
  const enabledRows = rows.filter(r => r.enabled)
  const total = roundMoney(enabledRows.reduce((s, r) => s + (parseAmount(r.amount) ?? 0), 0))

  function applyDeviceTimezone() {
    try {
      const device = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (device && timezones.includes(device)) setTimezone(device)
    } catch {
      // Older browsers: keep the current choice
    }
  }

  function goToPresets() {
    if (!name.trim()) return setError('Tell us what to call you')
    if (income.trim() !== '' && parseAmount(income) === null) return setError('Enter your monthly income as a number')
    setError('')
    setStep(1)
  }

  function choosePreset(next: string) {
    setPresetId(next)
    const preset = BUDGET_PRESETS.find(p => p.id === next)
    setGroups(preset?.groups ?? [])
    setRows(
      (preset?.categories ?? []).map((c, i) => ({
        key: `${next}-${i}`,
        enabled: true,
        name: c.name,
        icon: c.icon,
        amount: amountToInput(presetAmount(c, incomeValue)),
        group_key: c.group_key,
      }))
    )
    setError('')
    setStep(2)
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows(list => list.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows(list => [...list, { key: `custom-${Date.now()}`, enabled: true, name: '', icon: '💰', amount: '', group_key: null }])
  }

  function finish() {
    const categories: Array<{ name: string; icon: string; monthly_budget_amount: number; group_key: string | null }> = []
    for (const row of enabledRows) {
      const amount = row.amount.trim() === '' ? 0 : parseAmount(row.amount)
      if (!row.name.trim()) return setError('Every selected category needs a name (or untick it)')
      if (amount === null) return setError(`Check the amount for ${row.name}`)
      categories.push({ name: row.name, icon: row.icon, monthly_budget_amount: amount, group_key: row.group_key })
    }
    setError('')
    startTransition(async () => {
      const result = await completeOnboarding({
        display_name: name,
        monthly_income: incomeValue,
        timezone,
        groups,
        categories,
      })
      // On success the action redirects to the dashboard
      if (result && !result.success) setError(result.error)
    })
  }

  return (
    <div className="auth-container">
      <main id="main-content" className="auth-card animate-fadeIn" style={{ maxWidth: step === 2 ? 640 : 520 }}>
        <ol className="mb-7 flex gap-2" aria-label="Setup progress">
          {STEPS.map((label, index) => (
            <li key={label} className="flex-1">
              <span
                className="block h-1 rounded-full transition-colors"
                style={{ background: index <= step ? 'var(--brass)' : 'var(--ink-navy-4)' }}
                aria-hidden="true"
              />
              <span className={`mt-1.5 block text-[0.6875rem] ${index === step ? 'text-parchment' : 'text-parchment-faint'}`}>
                {index + 1}. {label}
                {index === step && <span className="sr-only"> (current step)</span>}
              </span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={event => {
              event.preventDefault()
              goToPresets()
            }}
          >
            <div>
              <h1 className="text-2xl font-bold text-parchment">Welcome to Ledger 👋</h1>
              <p className="mt-1 text-sm text-parchment-dim">Three quick steps and your budget is ready.</p>
            </div>
            <Field id={`${id}-name`} label="What should we call you?">
              <input id={`${id}-name`} className="input" value={name} maxLength={100} onChange={e => setName(e.target.value)} autoFocus />
            </Field>
            <Field id={`${id}-income`} label="Monthly take-home income" optional hint="Used to size the starter budget and show your savings rate.">
              <AmountInput id={`${id}-income`} value={income} onChange={setIncome} placeholder="50000" />
            </Field>
            <Field
              id={`${id}-tz`}
              label="Timezone"
              hint={
                <button type="button" className="text-brass hover:text-brass-light" onClick={applyDeviceTimezone}>
                  Use this device&apos;s timezone
                </button>
              }
            >
              <select id={`${id}-tz`} className="input" value={timezone} onChange={e => setTimezone(e.target.value)}>
                {timezones.map(zone => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary w-full">
              Continue
            </button>
          </form>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold text-parchment">Pick a starting point</h1>
              <p className="mt-1 text-sm text-parchment-dim">You can rename, resize or remove anything on the next screen and later in Settings.</p>
            </div>
            <ul className="flex flex-col gap-2">
              {BUDGET_PRESETS.map(preset => (
                <li key={preset.id}>
                  <button
                    type="button"
                    className="card card-interactive w-full text-left"
                    onClick={() => choosePreset(preset.id)}
                    aria-pressed={presetId === preset.id && rows.length > 0}
                  >
                    <p className="font-semibold text-parchment">{preset.name}</p>
                    <p className="mt-0.5 text-sm text-parchment-dim">{preset.description}</p>
                    <p className="mt-2 text-xs text-parchment-faint">
                      {preset.categories.slice(0, 6).map(c => c.icon).join(' ')} …
                    </p>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="card card-interactive w-full text-left" onClick={() => choosePreset('blank')}>
                  <p className="font-semibold text-parchment">Start from scratch</p>
                  <p className="mt-0.5 text-sm text-parchment-dim">Add your own categories one by one.</p>
                </button>
              </li>
            </ul>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
              ← Back
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold text-parchment">Your monthly budget</h1>
              <p className="mt-1 text-sm text-parchment-dim">
                Untick anything you do not need. Unspent money in a category is saved to its stack at month end.
              </p>
            </div>

            {rows.length === 0 ? (
              <p className="surface p-4 text-sm text-parchment-dim">No categories yet. Add your first one below, or skip and add them in Settings.</p>
            ) : (
              <ul className="surface max-h-[50vh] divide-y divide-white/5 overflow-y-auto">
                {rows.map(row => (
                  <li key={row.key} className={`flex items-center gap-2 px-3 py-2 ${row.enabled ? '' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[var(--brass)]"
                      checked={row.enabled}
                      onChange={e => updateRow(row.key, { enabled: e.target.checked })}
                      aria-label={`Include ${row.name || 'this category'}`}
                    />
                    <span className="w-6 shrink-0 text-center" aria-hidden="true">
                      {row.icon}
                    </span>
                    <label className="sr-only" htmlFor={`${id}-${row.key}-name`}>
                      Category name
                    </label>
                    <input
                      id={`${id}-${row.key}-name`}
                      className="input min-w-0 flex-1"
                      value={row.name}
                      maxLength={100}
                      placeholder="Category name"
                      onChange={e => updateRow(row.key, { name: e.target.value })}
                      disabled={!row.enabled}
                    />
                    <label className="sr-only" htmlFor={`${id}-${row.key}-amount`}>
                      Monthly amount for {row.name}
                    </label>
                    <AmountInput
                      id={`${id}-${row.key}-amount`}
                      className="w-32 shrink-0"
                      value={row.amount}
                      onChange={value => updateRow(row.key, { amount: value })}
                      disabled={!row.enabled}
                    />
                  </li>
                ))}
              </ul>
            )}

            <button type="button" className="btn btn-outline btn-sm self-start" onClick={addRow}>
              + Add a category
            </button>

            <div className="surface flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="text-parchment-dim">
                {enabledRows.length} categories · <span className="font-mono text-parchment">{formatCurrency(total)}</span> a month
              </span>
              {incomeValue > 0 && (
                <span className={total > incomeValue ? 'text-warning' : 'text-teal'}>
                  {total > incomeValue
                    ? `${formatCurrency(total - incomeValue)} over your income`
                    : `${formatCurrency(incomeValue - total)} left unassigned`}
                </span>
              )}
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)} disabled={pending}>
                ← Back
              </button>
              <button type="button" className="btn btn-primary flex-1" onClick={finish} disabled={pending}>
                {pending && <span className="spinner" aria-hidden="true" />}
                {pending ? 'Setting things up…' : enabledRows.length ? 'Create my budget' : 'Skip for now'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
