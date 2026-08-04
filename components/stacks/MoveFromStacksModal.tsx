'use client'

import { useState, useTransition } from 'react'
import { formatCurrency } from '@/lib/utils/format'
import { reallocateFromStacks } from '@/app/actions/stacks'

interface StackSource {
  category_id: string
  name: string
  icon: string | null
  current_balance: number
  selected_amount: string
  selected: boolean
}

interface CurrentPeriod {
  category_id: string
  name: string
  month: number
  year: number
}

interface MoveFromStacksModalProps {
  stacks: Array<{ category_id: string; name: string; icon: string | null; current_balance: number }>
  currentPeriods: CurrentPeriod[]
  onClose: () => void
  onSuccess: () => void
  preselectedCategoryId?: string
}

type DestType = 'period' | 'stack' | 'stock'

export function MoveFromStacksModal({
  stacks,
  currentPeriods,
  onClose,
  onSuccess,
  preselectedCategoryId,
}: MoveFromStacksModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [sources, setSources] = useState<StackSource[]>(
    stacks.map(s => ({
      ...s,
      selected_amount: '',
      selected: s.category_id === preselectedCategoryId,
    }))
  )

  const [destType, setDestType] = useState<DestType>('period')
  const [destCategoryId, setDestCategoryId] = useState(
    currentPeriods[0]?.category_id ?? ''
  )
  const [tickerOrNote, setTickerOrNote] = useState('')
  const [comment, setComment] = useState('')

  const totalMoved = sources.reduce((sum, s) => {
    if (!s.selected) return sum
    const amt = parseFloat(s.selected_amount)
    return sum + (isNaN(amt) ? 0 : amt)
  }, 0)

  function toggleSource(id: string) {
    setSources(prev =>
      prev.map(s => s.category_id === id ? { ...s, selected: !s.selected } : s)
    )
  }

  function updateAmount(id: string, val: string) {
    setSources(prev =>
      prev.map(s => s.category_id === id ? { ...s, selected_amount: val } : s)
    )
  }

  function validate(): string | null {
    const selected = sources.filter(s => s.selected)
    if (!selected.length) return 'Select at least one source stack'

    for (const s of selected) {
      const amt = parseFloat(s.selected_amount)
      if (!s.selected_amount || isNaN(amt) || amt <= 0) {
        return `Enter a valid amount for ${s.name}`
      }
      if (amt > s.current_balance) {
        return `Amount exceeds ${s.name}'s stack balance (${formatCurrency(s.current_balance)})`
      }
    }

    if (!comment.trim()) return 'Comment is required — explain why you are moving this money'
    if (destType !== 'stock' && !destCategoryId) return 'Select a destination'
    if (destType === 'stock' && !tickerOrNote.trim()) return 'Enter a stock name or ticker'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError('')

    const selected = sources.filter(s => s.selected)
    const sourcePayload = selected.map(s => ({
      category_id: s.category_id,
      amount: parseFloat(s.selected_amount),
    }))

    const destPeriod = currentPeriods.find(p => p.category_id === destCategoryId)

    startTransition(async () => {
      const result = await reallocateFromStacks({
        sources: sourcePayload,
        dest_type: destType,
        dest_category_id: destType !== 'stock' ? destCategoryId : undefined,
        dest_period_month: destType === 'period' ? destPeriod?.month : undefined,
        dest_period_year: destType === 'period' ? destPeriod?.year : undefined,
        ticker_or_note: destType === 'stock' ? tickerOrNote : undefined,
        comment,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      onSuccess()
      onClose()
    })
  }

  const selectedCount = sources.filter(s => s.selected).length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-parchment">Move Stack Money</h2>
            <p className="text-xs text-parchment-dim mt-0.5">
              Pull from accumulated stacks and redirect anywhere
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost p-1.5"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} id="move-stacks-form">
          {/* ─── Sources ─────────────────────────────── */}
          <fieldset className="mb-5">
            <legend className="input-label mb-3">
              Sources — select stacks &amp; enter amounts
            </legend>
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
              {sources.map(s => (
                <div
                  key={s.category_id}
                  className="flex items-center gap-3 p-2.5 rounded-lg transition-all"
                  style={{
                    background: s.selected ? 'var(--ink-navy-3)' : 'var(--ink-navy)',
                    border: s.selected
                      ? '1px solid rgba(45,212,191,0.2)'
                      : '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <input
                    type="checkbox"
                    id={`src-${s.category_id}`}
                    checked={s.selected}
                    onChange={() => toggleSource(s.category_id)}
                    className="w-4 h-4 accent-teal flex-shrink-0 cursor-pointer"
                    aria-label={`Select ${s.name} as source`}
                  />
                  <label
                    htmlFor={`src-${s.category_id}`}
                    className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                  >
                    <span>{s.icon ?? '💰'}</span>
                    <span className="text-sm text-parchment truncate">{s.name}</span>
                    <span className="text-xs font-mono text-teal ml-auto flex-shrink-0">
                      {formatCurrency(s.current_balance)}
                    </span>
                  </label>
                  {s.selected && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-parchment-faint text-sm font-mono">₹</span>
                      <input
                        type="number"
                        value={s.selected_amount}
                        onChange={e => updateAmount(s.category_id, e.target.value)}
                        className="input font-mono text-right"
                        style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        placeholder="0"
                        min="1"
                        max={s.current_balance}
                        step="0.01"
                        aria-label={`Amount from ${s.name}`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedCount > 0 && (
              <div className="mt-2 text-right">
                <span className="text-xs font-mono text-parchment-dim">
                  Total to move:{' '}
                  <span className="text-teal font-semibold">{formatCurrency(totalMoved)}</span>
                </span>
              </div>
            )}
          </fieldset>

          {/* ─── Destination ────────────────────────── */}
          <fieldset className="mb-5">
            <legend className="input-label mb-3">Destination</legend>
            <div className="flex gap-2 mb-3">
              {([
                ['period', '📥 Add to budget', 'Add to this month\'s remaining'],
                ['stack', '🗂️ Move to stack', 'Combine into another stack'],
                ['stock', '📈 Fund stock buy', 'Log a stock purchase'],
              ] as const).map(([type, label, hint]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDestType(type)}
                  className="flex-1 p-2 rounded-lg border text-center transition-all text-xs"
                  style={{
                    background: destType === type ? 'rgba(201,168,76,0.1)' : 'var(--ink-navy)',
                    borderColor: destType === type ? 'var(--brass)' : 'rgba(255,255,255,0.08)',
                    color: destType === type ? 'var(--brass)' : 'var(--parchment-dim)',
                  }}
                  aria-pressed={destType === type}
                  title={hint}
                >
                  {label}
                </button>
              ))}
            </div>

            {destType === 'period' && (
              <div>
                <label htmlFor="dest-period-cat" className="input-label text-[0.625rem]">
                  Destination category (live budget)
                </label>
                <select
                  id="dest-period-cat"
                  value={destCategoryId}
                  onChange={e => setDestCategoryId(e.target.value)}
                  className="input"
                >
                  {currentPeriods.map(p => (
                    <option key={p.category_id} value={p.category_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {destType === 'stack' && (
              <div>
                <label htmlFor="dest-stack-cat" className="input-label text-[0.625rem]">
                  Destination stack
                </label>
                <select
                  id="dest-stack-cat"
                  value={destCategoryId}
                  onChange={e => setDestCategoryId(e.target.value)}
                  className="input"
                >
                  {stacks.map(s => (
                    <option key={s.category_id} value={s.category_id}>
                      {s.name} — {formatCurrency(s.current_balance)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {destType === 'stock' && (
              <div>
                <label htmlFor="dest-stock-ticker" className="input-label text-[0.625rem]">
                  Stock / ticker / note
                </label>
                <input
                  id="dest-stock-ticker"
                  type="text"
                  value={tickerOrNote}
                  onChange={e => setTickerOrNote(e.target.value)}
                  className="input"
                  placeholder="e.g. NIFTY ETF, SIP — HDFC FlexiCap"
                  maxLength={200}
                />
              </div>
            )}
          </fieldset>

          {/* ─── Comment ─────────────────────────────── */}
          <div className="mb-5">
            <label htmlFor="realloc-comment" className="input-label">
              Comment <span className="text-danger">*</span>
            </label>
            <textarea
              id="realloc-comment"
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="input"
              style={{ resize: 'vertical', minHeight: '72px' }}
              placeholder="Why are you moving this money? (required for audit trail)"
              maxLength={500}
              required
            />
            <p className="text-parchment-faint text-xs mt-1">
              {comment.length}/500 — This builds your reviewable history
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button
              id="move-stacks-submit"
              type="submit"
              className="btn btn-primary flex-2"
              style={{ flex: 2 }}
              disabled={isPending || totalMoved <= 0}
            >
              {isPending ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-ink-navy/30 border-t-ink-navy rounded-full animate-spin" />
                  Moving…
                </>
              ) : (
                `Move ${totalMoved > 0 ? formatCurrency(totalMoved) : '—'}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
