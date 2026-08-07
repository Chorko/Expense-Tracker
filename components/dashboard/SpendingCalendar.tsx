'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils/format'

interface TransactionItem {
  id: string
  amount: number
  description: string | null
  txn_date: string
  categories?: { name: string; icon: string | null } | null
}

interface SpendingCalendarProps {
  month: number // 1-12
  year: number
  transactions: TransactionItem[]
  onAddTransactionOnDate?: (dateStr: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SpendingCalendar({
  month,
  year,
  transactions,
  onAddTransactionOnDate,
}: SpendingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Calculate calendar grid dates
  const firstDayOfMonth = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startWeekday = firstDayOfMonth.getDay() // 0 = Sun

  const todayStr = new Date().toISOString().slice(0, 10)

  // Map transactions by YYYY-MM-DD date string
  const dailySpendMap: Record<string, { total: number; items: TransactionItem[] }> = {}

  for (const txn of transactions) {
    const d = txn.txn_date
    if (!dailySpendMap[d]) {
      dailySpendMap[d] = { total: 0, items: [] }
    }
    dailySpendMap[d].total += txn.amount
    dailySpendMap[d].items.push(txn)
  }

  // Generate grid cells
  const calendarCells = []

  // Empty leading padding cells
  for (let i = 0; i < startWeekday; i++) {
    calendarCells.push({ type: 'empty', id: `empty-${i}` })
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const spendData = dailySpendMap[dateStr] || { total: 0, items: [] }
    const isToday = dateStr === todayStr

    calendarCells.push({
      type: 'day',
      dayNumber: day,
      dateStr,
      totalSpent: spendData.total,
      items: spendData.items,
      isToday,
    })
  }

  const selectedSpendData = selectedDate ? dailySpendMap[selectedDate] : null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-parchment text-sm">Daily Spending Calendar</h3>
          <p className="text-parchment-faint text-xs mt-0.5">
            Click any date to view or add daily expenses
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-parchment-faint">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal/20 border border-teal/40 inline-block" /> Light
          </span>
          <span className="flex items-center gap-1 text-parchment-faint">
            <span className="w-2.5 h-2.5 rounded-sm bg-brass/30 border border-brass/50 inline-block" /> Moderate
          </span>
          <span className="flex items-center gap-1 text-parchment-faint">
            <span className="w-2.5 h-2.5 rounded-sm bg-rust/30 border border-rust/50 inline-block" /> High
          </span>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-[0.625rem] font-mono uppercase tracking-widest text-parchment-faint py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell) => {
          if (cell.type === 'empty') {
            return <div key={cell.id} className="h-16 rounded-lg bg-transparent" />
          }

          const dayNumber = cell.dayNumber!
          const dateStr = cell.dateStr!
          const totalSpent = cell.totalSpent ?? 0
          const items = cell.items ?? []
          const isToday = cell.isToday ?? false
          const hasSpent = totalSpent > 0

          // Intensity colors
          let bgStyle = 'var(--ink-navy)'
          let borderStyle = 'rgba(255,255,255,0.05)'
          let textColor = 'var(--parchment-dim)'

          if (hasSpent) {
            if (totalSpent > 3000) {
              bgStyle = 'rgba(239,68,68,0.15)'
              borderStyle = 'rgba(239,68,68,0.35)'
              textColor = 'var(--rust-light)'
            } else if (totalSpent > 1000) {
              bgStyle = 'rgba(201,168,76,0.15)'
              borderStyle = 'rgba(201,168,76,0.35)'
              textColor = 'var(--brass)'
            } else {
              bgStyle = 'rgba(45,212,191,0.12)'
              borderStyle = 'rgba(45,212,191,0.3)'
              textColor = 'var(--teal)'
            }
          }

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelectedDate(dateStr ?? null)}
              className="h-16 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all hover:scale-[1.02] hover:border-brass/50 focus:outline-none relative group"
              style={{
                background: bgStyle,
                borderColor: isToday ? 'var(--brass)' : borderStyle,
                boxShadow: isToday ? '0 0 10px rgba(201,168,76,0.2)' : 'none',
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs font-mono font-medium rounded-full px-1.5 py-0.2 ${
                    isToday ? 'bg-brass text-ink-navy font-bold' : 'text-parchment-dim'
                  }`}
                >
                  {dayNumber}
                </span>
                {items.length > 0 && (
                  <span className="text-[0.625rem] text-parchment-faint font-mono">
                    {items.length} {items.length === 1 ? 'txn' : 'txns'}
                  </span>
                )}
              </div>

              {hasSpent ? (
                <span className="font-mono text-xs font-bold truncate w-full" style={{ color: textColor }}>
                  ₹{totalSpent.toLocaleString('en-IN')}
                </span>
              ) : (
                <span className="text-[0.625rem] text-parchment-faint opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  ₹0
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Date Detail Modal / Popover */}
      {selectedDate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedDate(null)}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-parchment text-base">
                  {formatDate(selectedDate)}
                </h3>
                <p className="text-xs text-parchment-faint font-mono mt-0.5">
                  Total Spent: <strong className="text-brass font-bold">{formatCurrency(selectedSpendData?.total ?? 0)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="btn btn-ghost p-1.5 text-parchment-faint hover:text-parchment"
              >
                ✕
              </button>
            </div>

            {selectedSpendData?.items && selectedSpendData.items.length > 0 ? (
              <div className="flex flex-col divide-y divide-white/5 max-h-60 overflow-y-auto mb-4">
                {selectedSpendData.items.map(txn => (
                  <div key={txn.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{txn.categories?.icon || '💳'}</span>
                      <div>
                        <p className="text-xs font-medium text-parchment">
                          {txn.description || txn.categories?.name || 'Expense'}
                        </p>
                        {txn.description && txn.categories?.name && (
                          <p className="text-[0.625rem] text-parchment-faint">{txn.categories.name}</p>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold text-brass">
                      − {formatCurrency(txn.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-parchment-faint text-xs mb-4">
                No transactions recorded on this day.
              </div>
            )}

            <div className="flex gap-2">
              {onAddTransactionOnDate && (
                <button
                  type="button"
                  onClick={() => {
                    const d = selectedDate
                    setSelectedDate(null)
                    onAddTransactionOnDate(d)
                  }}
                  className="btn btn-primary w-full text-xs"
                >
                  + Add Expense on {formatDate(selectedDate)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
