// Shared formatting utilities

export const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export const INR_DECIMAL = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(amount: number, decimals = false): string {
  return decimals ? INR_DECIMAL.format(amount) : INR.format(amount)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((date.getTime() - today.getTime()) / 86_400_000)

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)} days ago`
  return `In ${diff} days`
}

export function getMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en-IN', { month: 'long' })
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max)
}

export function pct(spent: number, total: number): number {
  if (total <= 0) return 0
  return clamp((spent / total) * 100, 0, 100)
}

// Sanitize text for display (React already escapes, but useful for dangerouslySetInnerHTML-free checks)
export function sanitizeText(input: string): string {
  return input.replace(/[<>&"'`]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;',
    '"': '&quot;', "'": '&#39;', '`': '&#96;',
  }[char] ?? char))
}

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Color palette for charts — matches the dark ledger theme
export const CHART_COLORS = [
  '#c9a84c', // brass
  '#2dd4bf', // teal
  '#e07a5f', // rust
  '#6c8ebf', // slate-blue
  '#b8a89a', // tan
  '#8b5cf6', // purple
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
]
