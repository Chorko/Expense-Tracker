'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { formatDate, monthRange, toYmd, weekday, type MonthRef } from '@/lib/dates'
import { formatCurrency, roundMoney } from '@/lib/format'
import type { CategoryMeta, TxnRow } from '@/lib/types'

type SpendingCalendarProps = {
  month: MonthRef
  today: string
  transactions: TxnRow[]
  categoryMeta: Record<string, CategoryMeta>
  /** Average budget per day; colours are relative to it */
  dailyBudget: number
  onAddOnDate: (date: string) => void
  onEdit: (txn: TxnRow) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const LEVELS = {
  none: { bg: 'var(--ink-navy)', border: 'rgba(255,255,255,0.05)', text: 'var(--parchment-faint)' },
  light: { bg: 'rgba(45,212,191,0.10)', border: 'rgba(45,212,191,0.28)', text: 'var(--teal)' },
  moderate: { bg: 'rgba(201,168,76,0.14)', border: 'rgba(201,168,76,0.34)', text: 'var(--brass)' },
  high: { bg: 'rgba(248,113,113,0.13)', border: 'rgba(248,113,113,0.34)', text: 'var(--danger)' },
}

export function SpendingCalendar({
  month,
  today,
  transactions,
  categoryMeta,
  dailyBudget,
  onAddOnDate,
  onEdit,
}: SpendingCalendarProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const { start, days } = monthRange(month)
  const lead = weekday(start)

  const byDay = new Map<string, { total: number; items: TxnRow[] }>()
  for (const txn of transactions) {
    const entry = byDay.get(txn.txn_date) ?? { total: 0, items: [] }
    entry.total = roundMoney(entry.total + txn.amount)
    entry.items.push(txn)
    byDay.set(txn.txn_date, entry)
  }
  const maxDay = Math.max(0, ...[...byDay.values()].map(d => d.total))
  const reference = dailyBudget > 0 ? dailyBudget : maxDay

  function level(total: number): keyof typeof LEVELS {
    if (total <= 0 || reference <= 0) return 'none'
    const ratio = total / reference
    if (ratio < 0.6) return 'light'
    if (ratio < 1.3) return 'moderate'
    return 'high'
  }

  const selectedDay = selected ? byDay.get(selected) : undefined

  return (
    <section className="card" aria-labelledby="calendar-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="calendar-title" className="section-title">
            Daily spending
          </h2>
          <p className="text-xs text-parchment-faint">
            {dailyBudget > 0 ? `Colours compare each day with your ${formatCurrency(dailyBudget)} daily budget` : 'Tap a day to see or add expenses'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-parchment-faint" aria-hidden="true">
          {(['light', 'moderate', 'high'] as const).map(key => (
            <span key={key} className="flex items-center gap-1 capitalize">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ background: LEVELS[key].bg, borderColor: LEVELS[key].border }} />
              {key === 'light' ? 'Under' : key === 'moderate' ? 'Around' : 'Over'}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" aria-hidden="true">
        {WEEKDAYS.map(day => (
          <div key={day} className="py-1 font-mono text-[0.625rem] uppercase tracking-widest text-parchment-faint">
            <span className="sm:hidden">{day[0]}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = toYmd(month.year, month.month, i + 1)
          const entry = byDay.get(date)
          const total = entry?.total ?? 0
          const style = LEVELS[level(total)]
          const isToday = date === today
          const isFuture = date > today
          const count = entry?.items.length ?? 0
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(date)}
              className="flex h-14 flex-col justify-between rounded-lg border p-1 text-left transition-colors hover:border-brass/60 sm:h-16 sm:p-1.5"
              style={{
                background: style.bg,
                borderColor: isToday ? 'var(--brass)' : style.border,
                opacity: isFuture && total === 0 ? 0.45 : 1,
              }}
              aria-label={`${formatDate(date)}: ${total > 0 ? `${formatCurrency(total)} in ${count} ${count === 1 ? 'expense' : 'expenses'}` : 'no spending'}`}
              aria-current={isToday ? 'date' : undefined}
            >
              <span
                className={`w-fit rounded-full px-1 font-mono text-[0.6875rem] ${isToday ? 'bg-brass font-bold text-ink-navy' : 'text-parchment-dim'}`}
              >
                {i + 1}
              </span>
              {total > 0 && (
                <span className="truncate font-mono text-[0.625rem] font-semibold sm:text-xs" style={{ color: style.text }}>
                  {formatCurrency(total, { compact: true, decimals: false })}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <Modal
          title={formatDate(selected)}
          description={selectedDay ? `${formatCurrency(selectedDay.total)} spent` : 'Nothing recorded on this day'}
          size="sm"
          onClose={() => setSelected(null)}
          footer={
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => {
                const date = selected
                setSelected(null)
                onAddOnDate(date)
              }}
            >
              + Add expense on this day
            </button>
          }
        >
          {selectedDay ? (
            <ul className="divide-y divide-white/5">
              {selectedDay.items.map(txn => {
                const meta = txn.category_id ? categoryMeta[txn.category_id] : undefined
                return (
                  <li key={txn.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-white/[0.02]"
                      onClick={() => {
                        setSelected(null)
                        onEdit(txn)
                      }}
                    >
                      <span aria-hidden="true">{meta?.icon ?? '💳'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-parchment">{txn.description || meta?.name || 'Uncategorised'}</span>
                        {txn.description && <span className="block truncate text-xs text-parchment-faint">{meta?.label ?? 'Uncategorised'}</span>}
                      </span>
                      <span className="font-mono text-sm text-parchment">{formatCurrency(txn.amount)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-parchment-faint">No expenses on this day.</p>
          )}
        </Modal>
      )}
    </section>
  )
}
