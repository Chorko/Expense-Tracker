import Link from 'next/link'
import { compareMonths, formatMonth, monthKey, monthOf, shiftMonth, type MonthRef } from '@/lib/dates'

type MonthSwitcherProps = {
  month: MonthRef
  /** User's today (YYYY-MM-DD) */
  today: string
  basePath: string
  /** Extra query params to keep (filters) */
  params?: Record<string, string | undefined>
  /** How many months past the current one can be opened */
  maxAhead?: number
}

function href(basePath: string, month: MonthRef, current: MonthRef, params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
  if (compareMonths(month, current) !== 0) query.set('month', monthKey(month))
  const qs = query.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function MonthSwitcher({ month, today, basePath, params = {}, maxAhead = 0 }: MonthSwitcherProps) {
  const current = monthOf(today)
  const prev = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)
  const canGoNext = compareMonths(next, shiftMonth(current, maxAhead)) <= 0
  const isCurrent = compareMonths(month, current) === 0

  return (
    <nav className="flex items-center gap-1" aria-label="Choose month">
      <Link
        href={href(basePath, prev, current, params)}
        className="btn btn-outline btn-icon"
        aria-label={`Previous month, ${formatMonth(prev)}`}
        scroll={false}
      >
        ‹
      </Link>
      <span className="min-w-[9.5rem] text-center text-sm font-semibold text-parchment" aria-live="polite">
        {formatMonth(month)}
      </span>
      {canGoNext ? (
        <Link
          href={href(basePath, next, current, params)}
          className="btn btn-outline btn-icon"
          aria-label={`Next month, ${formatMonth(next)}`}
          scroll={false}
        >
          ›
        </Link>
      ) : (
        <span className="btn btn-outline btn-icon opacity-40" aria-hidden="true">
          ›
        </span>
      )}
      {!isCurrent && (
        <Link href={href(basePath, current, current, params)} className="btn btn-ghost btn-sm ml-1" scroll={false}>
          This month
        </Link>
      )}
    </nav>
  )
}
