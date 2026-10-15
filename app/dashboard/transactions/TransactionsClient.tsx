'use client'

import { useId, useMemo, useState } from 'react'
import { TransactionModal } from '@/components/transactions/TransactionModal'
import { RecurringModal } from '@/components/transactions/RecurringModal'
import type { RecurringRuleView } from '@/components/transactions/types'
import { EmptyState, PageHeader } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { formatDate, formatMonth, formatRelativeDate, monthKey, monthRange, parseYmd, weekday, type MonthRef } from '@/lib/dates'
import { csvCell, formatCurrency, roundMoney } from '@/lib/format'
import { FREQUENCY_LABELS } from '@/lib/recurring'
import type { CategoryMeta, CategoryOption, TxnRow } from '@/lib/types'

type Tab = 'list' | 'recurring'
type SourceFilter = 'all' | 'manual' | 'recurring'

type TransactionsClientProps = {
  month: MonthRef
  today: string
  isLiveMonth: boolean
  monthSwitcher: React.ReactNode
  initialTab: Tab
  transactions: TxnRow[]
  rules: RecurringRuleView[]
  categoryMeta: Record<string, CategoryMeta>
  categoryOptions: CategoryOption[]
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHLY_FACTOR = { daily: 30.44, weekly: 4.35, monthly: 1, yearly: 1 / 12 } as const

function downloadCsv(filename: string, rows: string[][]) {
  // BOM so Excel opens UTF-8 (₹, emoji) correctly
  const csv = '\ufeff' + rows.map(row => row.join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function TransactionsClient(props: TransactionsClientProps) {
  const { month, today, transactions, rules, categoryMeta, categoryOptions } = props
  const toast = useToast()
  const searchId = useId()
  const [tab, setTab] = useState<Tab>(props.initialTab)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<TxnRow | null>(null)
  const [editingRule, setEditingRule] = useState<RecurringRuleView | 'new' | null>(null)

  function switchTab(next: Tab) {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'recurring') url.searchParams.set('tab', 'recurring')
    else url.searchParams.delete('tab')
    window.history.replaceState(null, '', url)
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    // A parent category also matches its sub-categories
    const allowed =
      categoryFilter === 'all' || categoryFilter === 'none'
        ? null
        : new Set([categoryFilter, ...categoryOptions.filter(o => o.parentId === categoryFilter).map(o => o.id)])
    return transactions.filter(txn => {
      if (categoryFilter === 'none' && txn.category_id) return false
      if (allowed && (!txn.category_id || !allowed.has(txn.category_id))) return false
      if (sourceFilter === 'recurring' && !txn.recurring_id) return false
      if (sourceFilter === 'manual' && txn.recurring_id) return false
      if (needle) {
        const meta = txn.category_id ? categoryMeta[txn.category_id] : undefined
        const haystack = `${txn.description ?? ''} ${meta?.label ?? 'uncategorised'}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [transactions, query, categoryFilter, sourceFilter, categoryOptions, categoryMeta])

  const total = roundMoney(filtered.reduce((sum, t) => sum + t.amount, 0))
  const largest = filtered.reduce<TxnRow | null>((max, t) => (!max || t.amount > max.amount ? t : max), null)
  const { days } = monthRange(month)
  const elapsedDays = props.isLiveMonth ? parseYmd(today).day : days
  const isFiltered = query !== '' || categoryFilter !== 'all' || sourceFilter !== 'all'

  const byDate = useMemo(() => {
    const groups = new Map<string, TxnRow[]>()
    for (const txn of filtered) groups.set(txn.txn_date, [...(groups.get(txn.txn_date) ?? []), txn])
    return [...groups.entries()]
  }, [filtered])

  const activeRules = rules.filter(r => r.is_active)
  const monthlyRecurring = roundMoney(activeRules.reduce((sum, r) => sum + r.amount * MONTHLY_FACTOR[r.frequency], 0))

  function exportCsv() {
    if (filtered.length === 0) return toast.info('Nothing to export with the current filters')
    const rows = [['Date', 'Description', 'Category', 'Amount (INR)', 'Source']]
    for (const txn of [...filtered].reverse()) {
      const meta = txn.category_id ? categoryMeta[txn.category_id] : undefined
      rows.push([
        txn.txn_date,
        csvCell(txn.description ?? ''),
        csvCell(meta?.label ?? 'Uncategorised'),
        txn.amount.toFixed(2),
        txn.recurring_id ? 'Recurring' : 'Manual',
      ])
    }
    downloadCsv(`ledger-${monthKey(month)}.csv`, rows)
    toast.success(`Exported ${filtered.length} transactions`)
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Transactions"
        subtitle={tab === 'list' ? formatMonth(month) : 'Expenses Ledger posts for you automatically'}
        actions={
          tab === 'list' ? (
            <>
              {props.monthSwitcher}
              <button type="button" className="btn btn-outline" onClick={exportCsv}>
                Export CSV
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                + Add expense
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setEditingRule('new')}>
              + New recurring
            </button>
          )
        }
      />

      <div className="segmented mb-5 max-w-sm" role="tablist" aria-label="Transactions view">
        <button type="button" role="tab" aria-selected={tab === 'list'} data-active={tab === 'list'} onClick={() => switchTab('list')}>
          This month
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'recurring'}
          data-active={tab === 'recurring'}
          onClick={() => switchTab('recurring')}
        >
          Recurring ({activeRules.length})
        </button>
      </div>

      {tab === 'list' ? (
        <>
          <section aria-label="Summary" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card card-tight">
              <p className="eyebrow">{isFiltered ? 'Matching total' : 'Total spent'}</p>
              <p className="mono-number mt-1 text-xl font-semibold text-parchment">{formatCurrency(total)}</p>
            </div>
            <div className="card card-tight">
              <p className="eyebrow">Transactions</p>
              <p className="mono-number mt-1 text-xl font-semibold text-parchment">{filtered.length}</p>
            </div>
            <div className="card card-tight">
              <p className="eyebrow">Per day</p>
              <p className="mono-number mt-1 text-xl font-semibold text-parchment">
                {formatCurrency(elapsedDays > 0 ? total / elapsedDays : 0, { decimals: false })}
              </p>
            </div>
            <div className="card card-tight">
              <p className="eyebrow">Largest</p>
              <p className="mono-number mt-1 truncate text-xl font-semibold text-parchment">
                {largest ? formatCurrency(largest.amount) : '—'}
              </p>
            </div>
          </section>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor={searchId} className="sr-only">
              Search transactions
            </label>
            <input
              id={searchId}
              type="search"
              className="input sm:max-w-xs"
              placeholder="Search notes or categories…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <label htmlFor={`${searchId}-cat`} className="sr-only">
              Filter by category
            </label>
            <select
              id={`${searchId}-cat`}
              className="input sm:max-w-xs"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              <option value="none">Uncategorised</option>
              {categoryOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.parentId ? '\u00a0\u00a0\u00a0' : ''}
                  {option.icon} {option.parentId ? option.name : option.label}
                </option>
              ))}
            </select>
            <div className="flex gap-1.5" role="group" aria-label="Filter by source">
              {(['all', 'manual', 'recurring'] as const).map(value => (
                <button key={value} type="button" className="chip capitalize" aria-pressed={sourceFilter === value} onClick={() => setSourceFilter(value)}>
                  {value}
                </button>
              ))}
            </div>
            {isFiltered && (
              <button
                type="button"
                className="btn btn-ghost btn-sm sm:ml-auto"
                onClick={() => {
                  setQuery('')
                  setCategoryFilter('all')
                  setSourceFilter('all')
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={isFiltered ? '🔍' : '🧾'}
              title={isFiltered ? 'No transactions match these filters' : `Nothing recorded in ${formatMonth(month)}`}
              description={isFiltered ? 'Try a different search or category.' : 'Add expenses as you spend and your budget updates instantly.'}
              action={
                !isFiltered && (
                  <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                    + Add expense
                  </button>
                )
              }
            />
          ) : (
            <div className="space-y-4">
              {byDate.map(([date, items]) => (
                <section key={date} className="card card-flush" aria-label={formatDate(date)}>
                  <header className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                    <h2 className="text-sm font-semibold text-parchment">
                      {formatRelativeDate(date, today) === 'Today' || formatRelativeDate(date, today) === 'Yesterday'
                        ? `${formatRelativeDate(date, today)} · `
                        : ''}
                      {WEEKDAY_NAMES[weekday(date)]}, {formatDate(date, { withYear: false })}
                    </h2>
                    <span className="font-mono text-xs text-parchment-dim">
                      {formatCurrency(roundMoney(items.reduce((s, t) => s + t.amount, 0)))}
                    </span>
                  </header>
                  <ul className="divide-y divide-white/5">
                    {items.map(txn => {
                      const meta = txn.category_id ? categoryMeta[txn.category_id] : undefined
                      return (
                        <li key={txn.id}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.025]"
                            onClick={() => setEditing(txn)}
                            aria-label={`Edit ${txn.description || meta?.name || 'expense'}, ${formatCurrency(txn.amount)}`}
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                              style={{ background: meta?.color ? `${meta.color}1f` : 'rgba(255,255,255,0.04)' }}
                              aria-hidden="true"
                            >
                              {meta?.icon ?? '💳'}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-parchment">{txn.description || meta?.name || 'Uncategorised'}</span>
                              <span className="flex items-center gap-2 truncate text-xs text-parchment-faint">
                                {meta?.label ?? 'Uncategorised'}
                                {meta && !meta.isActive && <span className="badge badge-muted">archived</span>}
                                {txn.recurring_id && <span className="badge badge-violet">recurring</span>}
                              </span>
                            </span>
                            <span className="mono-number text-sm font-semibold text-parchment">−{formatCurrency(txn.amount)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <RecurringList
          rules={rules}
          today={today}
          categoryMeta={categoryMeta}
          monthlyTotal={monthlyRecurring}
          onEdit={rule => setEditingRule(rule)}
          onAdd={() => setEditingRule('new')}
        />
      )}

      {adding && (
        <TransactionModal
          categories={categoryOptions}
          today={today}
          defaultCategoryId={categoryFilter !== 'all' && categoryFilter !== 'none' ? categoryFilter : undefined}
          defaultDate={props.isLiveMonth ? today : monthRange(month).end}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <TransactionModal categories={categoryOptions} today={today} transaction={editing} onClose={() => setEditing(null)} />
      )}
      {editingRule && (
        <RecurringModal
          categories={categoryOptions}
          today={today}
          rule={editingRule === 'new' ? undefined : editingRule}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  )
}

function RecurringList({
  rules,
  today,
  categoryMeta,
  monthlyTotal,
  onEdit,
  onAdd,
}: {
  rules: RecurringRuleView[]
  today: string
  categoryMeta: Record<string, CategoryMeta>
  monthlyTotal: number
  onEdit: (rule: RecurringRuleView) => void
  onAdd: () => void
}) {
  if (rules.length === 0) {
    return (
      <EmptyState
        icon="🔁"
        title="No recurring expenses yet"
        description="Add rent, subscriptions or SIPs once and Ledger posts them on every due date, even if you do not open the app."
        action={
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            + New recurring expense
          </button>
        }
      />
    )
  }

  return (
    <>
      <p className="mb-3 text-sm text-parchment-dim">
        Active rules cost about <span className="font-mono text-parchment">{formatCurrency(monthlyTotal, { decimals: false })}</span> a month.
      </p>
      <div className="card card-flush">
        <ul className="divide-y divide-white/5">
          {rules.map(rule => {
            const meta = rule.category_id ? categoryMeta[rule.category_id] : undefined
            return (
              <li key={rule.id}>
                <button
                  type="button"
                  onClick={() => onEdit(rule)}
                  className={`flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.025] ${rule.is_active ? '' : 'opacity-60'}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]" aria-hidden="true">
                    {meta?.icon ?? '🔁'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-parchment">{rule.description || meta?.name || 'Recurring expense'}</span>
                    <span className="block truncate text-xs text-parchment-faint">
                      {FREQUENCY_LABELS[rule.frequency]} · {meta?.label ?? 'Uncategorised'}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="mono-number block text-sm font-semibold text-parchment">{formatCurrency(rule.amount)}</span>
                    <span className="block text-xs text-parchment-faint">
                      {rule.is_active ? `Next ${formatRelativeDate(rule.next_due_date, today).toLowerCase()}` : 'Paused'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
