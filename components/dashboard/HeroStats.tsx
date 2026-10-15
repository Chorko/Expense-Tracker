import { formatCurrency, pct } from '@/lib/format'

type HeroStatsProps = {
  income: number
  spent: number
  uncategorised: number
  budgeted: number
  available: number
  remaining: number
  stackTotal: number
  /** Days left in the month including today; null for past months */
  daysLeft: number | null
}

function Stat({
  label,
  value,
  color,
  children,
}: {
  label: string
  value: string
  color: string
  children?: React.ReactNode
}) {
  return (
    <div className="card relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ background: `radial-gradient(circle at top right, ${color}, transparent 70%)` }}
        aria-hidden="true"
      />
      <p className="eyebrow">{label}</p>
      <p className="mono-number mt-2 text-2xl font-bold sm:text-[1.7rem]" style={{ color }}>
        {value}
      </p>
      {children && <div className="mt-1.5 space-y-0.5 text-xs text-parchment-dim">{children}</div>}
    </div>
  )
}

export function HeroStats(props: HeroStatsProps) {
  const { income, spent, uncategorised, budgeted, available, remaining, stackTotal, daysLeft } = props
  const usedPct = Math.round(pct(spent - uncategorised, available))
  const unassigned = income - budgeted
  const savingsRate = income > 0 ? Math.round(((income - spent) / income) * 100) : null
  const perDay = daysLeft && remaining > 0 ? remaining / daysLeft : 0

  return (
    <section aria-label="Month summary" className="stagger-children mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label={remaining < 0 ? 'Over budget' : 'Left to spend'}
        value={formatCurrency(Math.abs(remaining))}
        color={remaining < 0 ? 'var(--danger)' : 'var(--success)'}
      >
        {daysLeft !== null ? (
          remaining > 0 ? (
            <p>
              About <span className="font-mono text-parchment">{formatCurrency(perDay)}</span> a day for{' '}
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
            </p>
          ) : (
            <p>Pull from a stack or trim spending to get back on track</p>
          )
        ) : (
          <p>Unspent budget rolled into your stacks</p>
        )}
      </Stat>

      <Stat
        label="Spent"
        value={formatCurrency(spent)}
        color={usedPct >= 100 ? 'var(--danger)' : usedPct >= 85 ? 'var(--warning)' : 'var(--teal)'}
      >
        <p>
          {usedPct}% of {formatCurrency(available)} budget
        </p>
        {uncategorised > 0 && <p className="text-warning">{formatCurrency(uncategorised)} uncategorised</p>}
      </Stat>

      <Stat label="Monthly income" value={formatCurrency(income)} color="var(--brass)">
        {income > 0 ? (
          <>
            <p>
              {unassigned >= 0 ? (
                <>
                  <span className="font-mono text-parchment">{formatCurrency(unassigned)}</span> not assigned to a category
                </>
              ) : (
                <span className="text-warning">Budget exceeds income by {formatCurrency(-unassigned)}</span>
              )}
            </p>
            {savingsRate !== null && <p>Savings rate {savingsRate}%</p>}
          </>
        ) : (
          <p>Add your income in Settings to see your savings rate</p>
        )}
      </Stat>

      <Stat label="In stacks" value={formatCurrency(stackTotal)} color="var(--teal)">
        <p>Unspent budget saved from earlier months</p>
      </Stat>
    </section>
  )
}
