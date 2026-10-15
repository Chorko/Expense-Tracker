// Small presentational building blocks (server- and client-safe)
import { clamp } from '@/lib/format'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: string
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={`card text-center ${compact ? 'py-8' : 'py-14'}`}
      style={{ borderStyle: 'dashed', background: 'transparent' }}
    >
      <span className={`${compact ? 'text-3xl' : 'text-5xl'} block mb-3`} aria-hidden="true">
        {icon}
      </span>
      <p className="text-parchment font-medium">{title}</p>
      {description && <p className="text-parchment-dim text-sm mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ProgressBar({
  value,
  max,
  tone = 'ok',
  label,
  color,
}: {
  value: number
  max: number
  tone?: 'ok' | 'warning' | 'over' | 'idle' | 'teal'
  label: string
  color?: string
}) {
  const percent = max > 0 ? clamp((value / max) * 100, 0, 100) : value > 0 ? 100 : 0
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className={`progress-bar-fill ${tone}`} style={{ width: `${percent}%`, ...(color ? { background: color } : {}) }} />
    </div>
  )
}

export function Field({
  id,
  label,
  hint,
  error,
  optional = false,
  children,
  className = '',
}: {
  id: string
  label: string
  hint?: React.ReactNode
  error?: string
  optional?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="input-label">
        {label}
        {optional && <span className="ml-1 normal-case tracking-normal font-normal text-parchment-faint">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="input-error-msg" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="input-hint">{hint}</p>
      )}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />
}
