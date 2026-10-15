// Calendar-date helpers. Dates are plain 'YYYY-MM-DD' strings (what Postgres
// `date` columns return). All arithmetic is done in UTC so the server's own
// timezone never shifts a day.

export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_RE = /^(\d{4})-(\d{2})$/

export type MonthRef = { year: number; month: number }

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Every IANA timezone the runtime knows, with `current` guaranteed present. */
export function listTimezones(current: string = DEFAULT_TIMEZONE): string[] {
  let zones: string[]
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = [DEFAULT_TIMEZONE, 'UTC']
  }
  return zones.includes(current) ? zones : [current, ...zones]
}

/** Hour of the day (0-23) in `timezone`. */
export function hourIn(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): number {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now)
  return Number(hour) % 24
}

/** Today's date on the wall calendar of `timezone`. */
export function todayIn(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function isYmd(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = YMD_RE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo)
}

export function parseYmd(value: string): { year: number; month: number; day: number } {
  const m = YMD_RE.exec(value)
  if (!m) throw new Error(`Invalid date: ${value}`)
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

export function toYmd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function toUtc(value: string): number {
  const { year, month, day } = parseYmd(value)
  return Date.UTC(year, month - 1, day)
}

export function addDays(value: string, days: number): string {
  const d = new Date(toUtc(value) + days * 86_400_000)
  return toYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000)
}

/** Day of week, 0 = Sunday. */
export function weekday(value: string): number {
  return new Date(toUtc(value)).getUTCDay()
}

// ─── Months ──────────────────────────────────────────────────────────────────

export function monthOf(value: string): MonthRef {
  const { year, month } = parseYmd(value)
  return { year, month }
}

export function monthKey({ year, month }: MonthRef): string {
  return `${year}-${pad(month)}`
}

/** Parses '2026-10' style search params; anything invalid returns null. */
export function parseMonthKey(value: unknown): MonthRef | null {
  if (typeof value !== 'string') return null
  const m = MONTH_RE.exec(value)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null
  return { year, month }
}

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function compareMonths(a: MonthRef, b: MonthRef): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

export function monthRange({ year, month }: MonthRef): { start: string; end: string; days: number } {
  const days = daysInMonth(year, month)
  return { start: toYmd(year, month, 1), end: toYmd(year, month, days), days }
}

export function formatMonth({ year, month }: MonthRef, style: 'long' | 'short' = 'long'): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', {
    month: style,
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function monthName(month: number, style: 'long' | 'short' = 'long'): string {
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString('en-IN', { month: style, timeZone: 'UTC' })
}

// ─── Display ─────────────────────────────────────────────────────────────────

export function formatDate(value: string, opts: { withYear?: boolean } = {}): string {
  if (!isYmd(value)) return value
  return new Date(toUtc(value)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(opts.withYear === false ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  })
}

/** "Today", "In 3 days", "2 days ago" relative to the user's `today`. */
export function formatRelativeDate(value: string, today: string): string {
  if (!isYmd(value) || !isYmd(today)) return value
  const diff = diffDays(today, value)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)} days ago`
  return `In ${diff} days`
}

/** A timestamp (timestamptz) shown in the user's timezone. */
export function formatTimestamp(value: string | null, timezone: string = DEFAULT_TIMEZONE): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE,
  })
}
