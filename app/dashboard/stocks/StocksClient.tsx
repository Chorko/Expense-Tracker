'use client'

import { useId, useState, useTransition } from 'react'
import { updateStockNote } from '@/app/actions/stacks'
import { MoveMoneyModal } from '@/components/stacks/MoveMoneyModal'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Field, PageHeader } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { formatDate, parseYmd } from '@/lib/dates'
import { formatCurrency, roundMoney } from '@/lib/format'
import type { CategoryOption, GoalOption, StackOption } from '@/lib/types'

type Purchase = {
  id: string
  amount: number
  purchase_date: string
  ticker_or_note: string | null
  funded_from: Array<{ category_id: string | null; amount: number; label: string; icon: string }>
}

type StocksClientProps = {
  today: string
  purchases: Purchase[]
  stacks: StackOption[]
  categoryOptions: CategoryOption[]
  goalOptions: GoalOption[]
}

function RenameModal({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const id = useId()
  const toast = useToast()
  const [name, setName] = useState(purchase.ticker_or_note ?? '')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <Modal
      title="Rename investment"
      size="sm"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" form={id} className="btn btn-primary" disabled={pending}>
            Save
          </button>
        </>
      }
    >
      <form
        id={id}
        onSubmit={event => {
          event.preventDefault()
          startTransition(async () => {
            const result = await updateStockNote({ id: purchase.id, ticker_or_note: name })
            if (!result.success) return setError(result.error)
            toast.success('Investment renamed')
            onClose()
          })
        }}
      >
        <Field id={`${id}-name`} label="Stock or fund" error={error}>
          <input id={`${id}-name`} className="input" value={name} maxLength={200} onChange={e => setName(e.target.value)} autoFocus />
        </Field>
      </form>
    </Modal>
  )
}

export function StocksClient({ today, purchases, stacks, categoryOptions, goalOptions }: StocksClientProps) {
  const [recording, setRecording] = useState(false)
  const [renaming, setRenaming] = useState<Purchase | null>(null)
  const year = parseYmd(today).year
  const total = roundMoney(purchases.reduce((s, p) => s + p.amount, 0))
  const thisYear = roundMoney(purchases.filter(p => parseYmd(p.purchase_date).year === year).reduce((s, p) => s + p.amount, 0))

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Investments"
        subtitle="Stock and fund purchases paid for from your stacks"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setRecording(true)}
            disabled={stacks.length === 0}
            title={stacks.length === 0 ? 'Stacks are empty: nothing to invest yet' : undefined}
          >
            + Record purchase
          </button>
        }
      />

      <section aria-label="Totals" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card card-tight">
          <p className="eyebrow">Invested from stacks</p>
          <p className="mono-number mt-1 text-xl font-semibold text-brass">{formatCurrency(total)}</p>
        </div>
        <div className="card card-tight">
          <p className="eyebrow">In {year}</p>
          <p className="mono-number mt-1 text-xl font-semibold text-parchment">{formatCurrency(thisYear)}</p>
        </div>
        <div className="card card-tight">
          <p className="eyebrow">Purchases</p>
          <p className="mono-number mt-1 text-xl font-semibold text-parchment">{purchases.length}</p>
        </div>
      </section>

      {purchases.length === 0 ? (
        <EmptyState
          icon="📈"
          title="No investments recorded"
          description="When you buy a stock or fund with money saved in your stacks, record it here to keep a clear trail of where the money went."
          action={
            stacks.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => setRecording(true)}>
                + Record purchase
              </button>
            )
          }
        />
      ) : (
        <div className="card card-flush">
          <ul className="divide-y divide-white/5">
            {purchases.map(purchase => (
              <li key={purchase.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-parchment">{purchase.ticker_or_note || 'Investment'}</p>
                    <button
                      type="button"
                      className="text-xs text-parchment-faint hover:text-brass"
                      onClick={() => setRenaming(purchase)}
                      aria-label={`Rename ${purchase.ticker_or_note || 'investment'}`}
                    >
                      Rename
                    </button>
                  </div>
                  <p className="text-xs text-parchment-faint">{formatDate(purchase.purchase_date)}</p>
                  {purchase.funded_from.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Funded from">
                      {purchase.funded_from.map((source, index) => (
                        <li key={`${source.category_id}-${index}`} className="badge badge-muted normal-case tracking-normal">
                          <span aria-hidden="true">{source.icon}</span> {source.label} · {formatCurrency(source.amount)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="mono-number text-base font-semibold text-brass sm:text-right">{formatCurrency(purchase.amount)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recording && (
        <MoveMoneyModal
          stacks={stacks}
          categories={categoryOptions}
          goals={goalOptions}
          defaultDestination="stock"
          onClose={() => setRecording(false)}
        />
      )}
      {renaming && <RenameModal purchase={renaming} onClose={() => setRenaming(null)} />}
    </div>
  )
}
