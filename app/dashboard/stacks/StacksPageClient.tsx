'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { StackOverviewPanel } from '@/components/stacks/StackOverviewPanel'
import { MoveFromStacksModal } from '@/components/stacks/MoveFromStacksModal'
import { formatCurrency, formatDate } from '@/lib/utils/format'

interface StackEntry {
  current_balance: number
  last_updated: string
  categories: { id: string; name: string; icon: string | null; category_groups: { name: string; color_hex: string } | null } | null
}

interface HistoryEntry {
  id: string
  type: string
  amount: number
  comment: string | null
  month: number | null
  year: number | null
  created_at: string
  categories: { id: string; name: string; icon: string | null } | null
  related_categories: { id: string; name: string; icon: string | null } | null
}

interface StacksPageClientProps {
  stacks: StackEntry[]
  history: HistoryEntry[]
  stacksForModal: Array<{ category_id: string; name: string; icon: string | null; current_balance: number }>
  currentPeriods: Array<{ category_id: string; name: string; month: number; year: number }>
}

const TYPE_LABELS: Record<string, { label: string; color: string; prefix: string }> = {
  accrual: { label: 'Month-end rollover', color: 'var(--teal)', prefix: '+' },
  reallocation_out: { label: 'Moved out', color: 'var(--rust)', prefix: '-' },
  reallocation_in: { label: 'Moved in', color: 'var(--success)', prefix: '+' },
  pulled_to_period: { label: 'Added to budget', color: 'var(--brass)', prefix: '+' },
}

export function StacksPageClient({
  stacks,
  history,
  stacksForModal,
  currentPeriods,
}: StacksPageClientProps) {
  const router = useRouter()
  const [showMove, setShowMove] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')

  const handleSuccess = useCallback(() => router.refresh(), [router])

  const chartData = stacks.map(s => ({
    name: s.categories?.name ?? 'Unknown',
    balance: s.current_balance,
    icon: s.categories?.icon ?? null,
    color: s.categories?.category_groups?.color_hex ?? '#2dd4bf',
  }))

  const totalStack = stacks.reduce((s, st) => s + st.current_balance, 0)

  const filteredHistory = filterCat === 'all'
    ? history
    : history.filter(h => h.categories?.id === filterCat)

  const uniqueCategories = Array.from(
    new Map(
      history
        .filter(h => h.categories)
        .map(h => [h.categories!.id, h.categories!])
    ).values()
  )

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-parchment">Stacks</h1>
          <p className="text-parchment-dim text-sm mt-0.5">
            Accumulated unused budget — grows until you act on it
          </p>
        </div>
        {stacksForModal.length > 0 && (
          <button
            id="btn-move-stacks-page"
            onClick={() => setShowMove(true)}
            className="btn btn-primary"
          >
            ⊞ Move stack money
          </button>
        )}
      </div>

      {/* Total */}
      <div className="card mb-6" style={{ borderColor: 'rgba(45,212,191,0.2)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">
              Total accumulated across all stacks
            </p>
            <p className="font-mono font-bold text-3xl text-teal">
              {formatCurrency(totalStack)}
            </p>
          </div>
          <span className="text-5xl opacity-20">⊞</span>
        </div>
      </div>

      {/* Stack bar chart */}
      <div className="mb-6">
        <StackOverviewPanel data={chartData} onCategoryClick={() => setShowMove(true)} />
      </div>

      {/* History feed */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-parchment text-sm">Stack History</h2>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="input text-sm"
            style={{ width: 'auto', padding: '0.25rem 0.75rem' }}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-parchment-dim text-sm mb-1">No stack activity yet</p>
            <p className="text-parchment-faint text-xs">
              Activity appears here after your first month-end rollover or reallocation
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {filteredHistory.map(entry => {
              const typeInfo = TYPE_LABELS[entry.type] ?? {
                label: entry.type,
                color: 'var(--parchment)',
                prefix: '',
              }

              return (
                <div key={entry.id} className="py-3 flex items-start gap-3">
                  {/* Amount */}
                  <div
                    className="font-mono font-semibold text-sm flex-shrink-0 w-28 text-right"
                    style={{ color: typeInfo.color }}
                  >
                    {typeInfo.prefix}{formatCurrency(entry.amount)}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-parchment">
                        {entry.categories?.icon} {entry.categories?.name ?? 'Unknown'}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: `${typeInfo.color}18`,
                          color: typeInfo.color,
                        }}
                      >
                        {typeInfo.label}
                      </span>
                      {entry.related_categories && (
                        <span className="text-xs text-parchment-faint">
                          → {entry.related_categories.icon} {entry.related_categories.name}
                        </span>
                      )}
                    </div>
                    {entry.comment && (
                      <p
                        className="text-sm text-parchment-dim italic truncate"
                        title={entry.comment}
                      >
                        &ldquo;{entry.comment}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <span className="text-xs font-mono text-parchment-faint flex-shrink-0">
                    {formatDate(entry.created_at.slice(0, 10))}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showMove && stacksForModal.length > 0 && (
        <MoveFromStacksModal
          stacks={stacksForModal}
          currentPeriods={currentPeriods}
          onClose={() => setShowMove(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
