'use client'

import { useState } from 'react'
import { AdjustGoalModal, GoalModal } from '@/components/goals/GoalModals'
import { MoveMoneyModal } from '@/components/stacks/MoveMoneyModal'
import { EmptyState, PageHeader, ProgressBar } from '@/components/ui/primitives'
import { diffDays, formatDate } from '@/lib/dates'
import { formatCurrency, pct, roundMoney } from '@/lib/format'
import type { CategoryOption, GoalRow, StackOption } from '@/lib/types'

type GoalsClientProps = { goals: GoalRow[]; today: string; stacks: StackOption[]; categoryOptions: CategoryOption[] }

type Dialog =
  | { kind: 'new' }
  | { kind: 'edit'; goal: GoalRow }
  | { kind: 'adjust'; goal: GoalRow; direction: 'add' | 'withdraw' }
  | { kind: 'fund'; goal: GoalRow }

function pace(goal: GoalRow, today: string): string | null {
  const remaining = roundMoney(goal.target_amount - goal.current_amount)
  if (remaining <= 0) return null
  if (!goal.target_date) return `${formatCurrency(remaining)} to go`
  const days = diffDays(today, goal.target_date)
  if (days <= 0) return `Target date passed · ${formatCurrency(remaining)} to go`
  const months = Math.max(1, Math.ceil(days / 30.44))
  return `${formatCurrency(remaining / months, { decimals: false })} a month for ${months} ${months === 1 ? 'month' : 'months'}`
}

export function GoalsClient({ goals, today, stacks, categoryOptions }: GoalsClientProps) {
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const saved = roundMoney(goals.reduce((s, g) => s + g.current_amount, 0))
  const target = roundMoney(goals.reduce((s, g) => s + g.target_amount, 0))
  const goalOptions = goals.map(g => ({ id: g.id, name: g.name, icon: g.icon }))

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Goals"
        subtitle={goals.length ? `${formatCurrency(saved)} saved towards ${formatCurrency(target)}` : 'Save towards the things that matter'}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'new' })}>
            + New goal
          </button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No goals yet"
          description="Create a goal with a target and an optional date. Fund it from your stacks or record money you saved elsewhere."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'new' })}>
              + Create your first goal
            </button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map(goal => {
            const progress = Math.round(pct(goal.current_amount, goal.target_amount))
            const reached = goal.current_amount >= goal.target_amount
            const hint = pace(goal, today)
            return (
              <li key={goal.id} className="card flex flex-col" style={{ borderTop: `3px solid ${goal.color_hex}` }}>
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ background: `${goal.color_hex}22` }}
                    aria-hidden="true"
                  >
                    {goal.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold text-parchment">{goal.name}</h2>
                    <p className="text-xs text-parchment-faint">
                      {goal.target_date ? `By ${formatDate(goal.target_date)}` : 'No deadline'}
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: 'edit', goal })} aria-label={`Edit ${goal.name}`}>
                    Edit
                  </button>
                </div>

                <div className="mt-4 flex items-end justify-between gap-2">
                  <p className="mono-number text-2xl font-bold" style={{ color: goal.color_hex }}>
                    {formatCurrency(goal.current_amount)}
                  </p>
                  <p className="text-sm text-parchment-dim">
                    of <span className="font-mono">{formatCurrency(goal.target_amount)}</span>
                  </p>
                </div>
                <div className="mt-2">
                  <ProgressBar value={goal.current_amount} max={goal.target_amount} color={goal.color_hex} label={`${goal.name}: ${progress}% saved`} />
                </div>
                <p className="mt-2 text-xs text-parchment-faint">{reached ? '🎉 Goal reached' : `${progress}% · ${hint}`}</p>

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button
                    type="button"
                    className="btn btn-teal btn-sm"
                    onClick={() => setDialog({ kind: 'fund', goal })}
                    disabled={stacks.length === 0}
                    title={stacks.length === 0 ? 'Your stacks are empty' : undefined}
                  >
                    Fund from stacks
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setDialog({ kind: 'adjust', goal, direction: 'add' })}>
                    Add
                  </button>
                  {goal.current_amount > 0 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: 'adjust', goal, direction: 'withdraw' })}>
                      Withdraw
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {dialog?.kind === 'new' && <GoalModal today={today} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <GoalModal goal={dialog.goal} today={today} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'adjust' && <AdjustGoalModal goal={dialog.goal} direction={dialog.direction} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'fund' && (
        <MoveMoneyModal
          stacks={stacks}
          categories={categoryOptions}
          goals={goalOptions}
          defaultDestination="goal"
          defaultGoalId={dialog.goal.id}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
