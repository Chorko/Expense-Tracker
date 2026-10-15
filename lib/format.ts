// Number and money formatting (INR, Indian digit grouping)

const INR_WHOLE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const INR_PAISE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const INR_COMPACT = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Coerces numeric column values (number or numeric string) to a number. */
export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

type CurrencyOptions = {
  /** 'auto' shows paise only when the amount has them */
  decimals?: boolean | 'auto'
  compact?: boolean
  /** Prefix positive numbers with + */
  signed?: boolean
}

export function formatCurrency(amount: number, opts: CurrencyOptions = {}): string {
  const value = roundMoney(toNumber(amount))
  const { decimals = 'auto', compact = false, signed = false } = opts
  let text: string
  if (compact && Math.abs(value) >= 100_000) {
    text = INR_COMPACT.format(value)
  } else if (decimals === true || (decimals === 'auto' && !Number.isInteger(value))) {
    text = INR_PAISE.format(value)
  } else {
    text = INR_WHOLE.format(value)
  }
  return signed && value > 0 ? `+${text}` : text
}

/**
 * Parses what someone typed into an amount box ("1,250.50", "₹ 300").
 * Returns null for anything that is not a plain non-negative number with at
 * most two decimals.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]/g, '')
  if (cleaned === '' || cleaned === '.' || !/^\d*(\.\d{0,2})?$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** Formats a number for an editable amount box (no symbol or grouping). */
export function amountToInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return String(roundMoney(value))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Share of `total` used by `part`, 0-100 (0 when there is no total). */
export function pct(part: number, total: number): number {
  if (total <= 0) return part > 0 ? 100 : 0
  return clamp((part / total) * 100, 0, 100)
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

// Chart palette tuned for the dark ledger theme
export const CHART_COLORS = [
  '#c9a84c', // brass
  '#2dd4bf', // teal
  '#e07a5f', // terracotta
  '#6c8ebf', // slate blue
  '#a78bfa', // violet
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#b8a89a', // tan
]

/** Escapes one CSV cell (RFC 4180) and neutralises spreadsheet formulas. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
