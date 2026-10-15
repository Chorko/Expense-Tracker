'use client'

import { useId, useState, useTransition } from 'react'
import { adjustGoal, createGoal, deleteGoal, updateGoal } from '@/app/actions/goals'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AmountInput } from '@/components/ui/AmountInput'
import { Field } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { IconPicker, SwatchPicker } from '@/components/ui/Pickers'
import { GOAL_ICONS, GROUP_COLORS } from '@/lib/presets'
import { amountToInput, formatCurrency, parseAmount } from '@/lib/format'
import type { GoalRow } from '@/lib/types'

export function GoalModal({ goal, today, onClose }: { goal?: GoalRow; today: string; onClose: () => void }) {
  const id = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(goal?.name ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? GOAL_ICONS[0])
  const [color, setColor] = useState(goal?.color_hex ?? GROUP_COLORS[1])
  const [target, setTarget] = useState(amountToInput(goal?.target_amount))
  const [date, setDate] = useState(goal?.target_date ?? '')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function submit() {
    const value = parseAmount(target)
    if (!name.trim()) return setError('Name your goal')
    if (value === null || value <= 0) return setError('Enter a target amount')
    setError('')
    const payload = { name, icon, color_hex: color, target_amount: value, target_date: date || null }
    startTransition(async () => {
      const result = goal ? await updateGoal({ id: goal.id, ...payload }) : await createGoal(payload)
      if (!result.success) return setError(result.error)
      toast.success(goal ? 'Goal updated' : 'Goal created')
      onClose()
    })
  }

  return (
    <>
      <Modal
        title={goal ? 'Edit goal' : 'New savings goal'}
        onClose={onClose}
        busy={pending}
        footer={
          <div className="flex w-full items-center gap-2">
            {goal && (
              <button type="button" className="btn btn-danger mr-auto" onClick={() => setConfirmDelete(true)} disabled={pending}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn-ghost ml-auto" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form={id} className="btn btn-primary" disabled={pending}>
              {pending && <span className="spinner" aria-hidden="true" />}
              Save
            </button>
          </div>
        }
      >
        <form
          id={id}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            submit()
          }}
        >
          <Field id={`${id}-name`} label="Goal">
            <input id={`${id}-name`} className="input" value={name} maxLength={100} placeholder="e.g. Goa trip, new laptop" onChange={e => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={`${id}-target`} label="Target amount">
              <AmountInput id={`${id}-target`} value={target} onChange={setTarget} />
            </Field>
            <Field id={`${id}-date`} label="Target date" optional>
              <input id={`${id}-date`} type="date" className="input font-mono" value={date} min={goal ? undefined : today} onChange={e => setDate(e.target.value)} />
            </Field>
          </div>
          <fieldset>
            <legend className="input-label">Icon</legend>
            <IconPicker icons={GOAL_ICONS} value={icon} onChange={setIcon} label="Goal icon" />
          </fieldset>
          <fieldset>
            <legend className="input-label">Colour</legend>
            <SwatchPicker value={color} onChange={setColor} label="Goal colour" />
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>
      {confirmDelete && goal && (
        <ConfirmDialog
          title={`Delete “${goal.name}”?`}
          message={
            goal.current_amount > 0
              ? `The ${formatCurrency(goal.current_amount)} counted towards it is not moved anywhere; only the goal is removed.`
              : 'This cannot be undone.'
          }
          onConfirm={() => deleteGoal(goal.id)}
          onClose={() => setConfirmDelete(false)}
          onDone={() => {
            toast.success('Goal deleted')
            onClose()
          }}
        />
      )}
    </>
  )
}

export function AdjustGoalModal({
  goal,
  direction,
  onClose,
}: {
  goal: GoalRow
  direction: 'add' | 'withdraw'
  onClose: () => void
}) {
  const id = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)
  const [amount, setAmount] = useState(direction === 'add' && remaining > 0 ? amountToInput(remaining) : '')
  const [error, setError] = useState('')

  function submit() {
    const value = parseAmount(amount)
    if (value === null || value <= 0) return setError('Enter an amount greater than zero')
    if (direction === 'withdraw' && value > goal.current_amount + 0.001) {
      return setError(`Only ${formatCurrency(goal.current_amount)} is saved`)
    }
    setError('')
    startTransition(async () => {
      const result = await adjustGoal({ goal_id: goal.id, amount: value, direction })
      if (!result.success) return setError(result.error)
      toast.success(direction === 'add' ? `Added ${formatCurrency(value)} to ${goal.name}` : `Took ${formatCurrency(value)} out of ${goal.name}`)
      onClose()
    })
  }

  return (
    <Modal
      title={direction === 'add' ? `Add to ${goal.name}` : `Withdraw from ${goal.name}`}
      description={`${formatCurrency(goal.current_amount)} saved of ${formatCurrency(goal.target_amount)}`}
      size="sm"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" form={id} className={direction === 'add' ? 'btn btn-teal' : 'btn btn-primary'} disabled={pending}>
            {direction === 'add' ? 'Add' : 'Withdraw'}
          </button>
        </>
      }
    >
      <form
        id={id}
        noValidate
        onSubmit={event => {
          event.preventDefault()
          submit()
        }}
      >
        <Field
          id={`${id}-amount`}
          label="Amount"
          error={error}
          hint={direction === 'add' ? 'Use this for money saved outside Ledger. To use stack money, choose “Fund from stacks”.' : undefined}
        >
          <AmountInput id={`${id}-amount`} value={amount} onChange={setAmount} autoFocus invalid={Boolean(error)} />
        </Field>
      </form>
    </Modal>
  )
}
