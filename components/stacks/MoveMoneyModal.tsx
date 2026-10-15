'use client'

import { useId, useState, useTransition } from 'react'
import { moveStackMoney } from '@/app/actions/stacks'
import { Modal } from '@/components/ui/Modal'
import { AmountInput } from '@/components/ui/AmountInput'
import { Field } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { amountToInput, formatCurrency, parseAmount, roundMoney } from '@/lib/format'
import type { CategoryOption, GoalOption, StackOption } from '@/lib/types'
import type { StackDestination } from '@/lib/validations'

type MoveMoneyModalProps = {
  stacks: StackOption[]
  categories: CategoryOption[]
  goals: GoalOption[]
  preselectedSourceId?: string
  defaultDestination?: StackDestination
  defaultGoalId?: string
  onClose: () => void
}

const DESTINATIONS: Array<{ value: StackDestination; label: string; hint: string }> = [
  { value: 'period', label: "This month's budget", hint: 'Top up a category you are running low on' },
  { value: 'stack', label: 'Another stack', hint: 'Re-earmark savings for something else' },
  { value: 'goal', label: 'Savings goal', hint: 'Count it towards one of your goals' },
  { value: 'stock', label: 'Investment', hint: 'Record a stock or fund purchase' },
]

export function MoveMoneyModal({
  stacks,
  categories,
  goals,
  preselectedSourceId,
  defaultDestination = 'period',
  defaultGoalId,
  onClose,
}: MoveMoneyModalProps) {
  const formId = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const pre = stacks.find(s => s.categoryId === preselectedSourceId)
    return pre ? { [pre.categoryId]: amountToInput(pre.balance) } : {}
  })
  const [destType, setDestType] = useState<StackDestination>(defaultDestination)
  const [destCategoryId, setDestCategoryId] = useState('')
  const [destGoalId, setDestGoalId] = useState(
    goals.some(g => g.id === defaultGoalId) ? (defaultGoalId as string) : goals[0]?.id ?? ''
  )
  const [ticker, setTicker] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  const selectedIds = Object.keys(amounts)
  const total = roundMoney(selectedIds.reduce((sum, id) => sum + (parseAmount(amounts[id]) ?? 0), 0))
  const destinationOptions = destType === 'stack' ? categories.filter(c => !selectedIds.includes(c.id)) : categories

  function toggleSource(stack: StackOption) {
    setAmounts(current => {
      const next = { ...current }
      if (stack.categoryId in next) delete next[stack.categoryId]
      else next[stack.categoryId] = amountToInput(stack.balance)
      return next
    })
    setError('')
  }

  function submit() {
    const sources: Array<{ category_id: string; amount: number }> = []
    for (const stack of stacks) {
      if (!(stack.categoryId in amounts)) continue
      const value = parseAmount(amounts[stack.categoryId])
      if (value === null || value <= 0) return setError(`Enter an amount for ${stack.name}`)
      if (value > stack.balance + 0.001) return setError(`${stack.name} only has ${formatCurrency(stack.balance)}`)
      sources.push({ category_id: stack.categoryId, amount: value })
    }
    if (sources.length === 0) return setError('Choose at least one stack to take money from')
    if ((destType === 'period' || destType === 'stack') && !destCategoryId) return setError('Choose a destination category')
    if (destType === 'goal' && !destGoalId) return setError('Choose a goal')
    if (destType === 'stock' && !ticker.trim()) return setError('Enter the stock or fund name')
    if (!comment.trim()) return setError('Add a short note explaining this move')
    setError('')

    startTransition(async () => {
      const result = await moveStackMoney({
        sources,
        dest_type: destType,
        dest_category_id: destType === 'period' || destType === 'stack' ? destCategoryId : null,
        dest_goal_id: destType === 'goal' ? destGoalId : null,
        ticker_or_note: destType === 'stock' ? ticker : null,
        comment,
      })
      if (!result.success) return setError(result.error)
      toast.success(`Moved ${formatCurrency(result.data.total)} to ${result.data.destination || 'its destination'}`)
      onClose()
    })
  }

  return (
    <Modal
      title="Move money from stacks"
      description="Stacks hold the budget you did not spend in earlier months."
      onClose={onClose}
      busy={pending}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn btn-teal" disabled={pending || total <= 0}>
            {pending && <span className="spinner" aria-hidden="true" />}
            Move {formatCurrency(total)}
          </button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-5"
        onSubmit={event => {
          event.preventDefault()
          submit()
        }}
      >
        <fieldset>
          <legend className="input-label">Take money from</legend>
          {stacks.length === 0 ? (
            <p className="text-sm text-parchment-dim">No stack has money in it yet. Unspent budget lands here when a month closes.</p>
          ) : (
            <ul className="surface max-h-64 divide-y divide-white/5 overflow-y-auto">
              {stacks.map(stack => {
                const checked = stack.categoryId in amounts
                const inputId = `${formId}-src-${stack.categoryId}`
                return (
                  <li key={stack.categoryId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSource(stack)}
                        className="h-4 w-4 accent-[var(--teal)]"
                      />
                      <span aria-hidden="true">{stack.icon}</span>
                      <span className="min-w-0 truncate text-sm text-parchment">{stack.name}</span>
                      <span className="ml-auto font-mono text-xs text-teal">{formatCurrency(stack.balance)}</span>
                    </label>
                    {checked && (
                      <div className="flex w-full items-center gap-2 sm:w-44">
                        <label htmlFor={inputId} className="sr-only">
                          Amount from {stack.name}
                        </label>
                        <AmountInput
                          id={inputId}
                          value={amounts[stack.categoryId]}
                          onChange={value => setAmounts(a => ({ ...a, [stack.categoryId]: value }))}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-2 text-right text-xs text-parchment-faint">
            Total <span className="font-mono text-sm text-parchment">{formatCurrency(total)}</span>
          </p>
        </fieldset>

        <fieldset>
          <legend className="input-label">Send it to</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Destination type">
            {DESTINATIONS.map(option => {
              const disabled = option.value === 'goal' && goals.length === 0
              return (
                <button
                  key={option.value}
                  type="button"
                  className="chip justify-center"
                  aria-pressed={destType === option.value}
                  onClick={() => {
                    setDestType(option.value)
                    setError('')
                  }}
                  disabled={disabled}
                  title={disabled ? 'Create a savings goal first' : option.hint}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <p className="input-hint">{DESTINATIONS.find(d => d.value === destType)?.hint}</p>
        </fieldset>

        {(destType === 'period' || destType === 'stack') && (
          <Field id={`${formId}-dest`} label={destType === 'period' ? 'Category to top up' : 'Destination stack'}>
            <select
              id={`${formId}-dest`}
              className="input"
              value={destCategoryId}
              onChange={event => setDestCategoryId(event.target.value)}
            >
              <option value="">Choose a category…</option>
              {destinationOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {destType === 'goal' && (
          <Field id={`${formId}-goal`} label="Goal">
            <select id={`${formId}-goal`} className="input" value={destGoalId} onChange={e => setDestGoalId(e.target.value)}>
              {goals.map(goal => (
                <option key={goal.id} value={goal.id}>
                  {goal.icon} {goal.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {destType === 'stock' && (
          <Field id={`${formId}-ticker`} label="Stock or fund">
            <input
              id={`${formId}-ticker`}
              className="input"
              value={ticker}
              maxLength={200}
              placeholder="e.g. NIFTYBEES, Parag Parikh Flexi Cap"
              onChange={e => setTicker(e.target.value)}
            />
          </Field>
        )}

        <Field id={`${formId}-comment`} label="Why are you moving it?" hint="Saved in the stack history.">
          <textarea
            id={`${formId}-comment`}
            className="input"
            value={comment}
            maxLength={500}
            rows={2}
            placeholder="e.g. Covering the car service this month"
            onChange={e => setComment(e.target.value)}
          />
        </Field>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
