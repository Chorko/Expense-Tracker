// Mirrors public.next_recurring_date() in migration 005 so previews in the UI
// match what the database will post.
import { addDays, daysInMonth, parseYmd, shiftMonth, toYmd } from '@/lib/dates'
import type { Frequency } from '@/lib/validations'

export function nextRecurringDate(from: string, frequency: Frequency, anchorDay: number | null): string {
  if (frequency === 'daily') return addDays(from, 1)
  if (frequency === 'weekly') return addDays(from, 7)
  const { year, month, day } = parseYmd(from)
  const next = shiftMonth({ year, month }, frequency === 'monthly' ? 1 : 12)
  const anchor = anchorDay ?? day
  return toYmd(next.year, next.month, Math.min(anchor, daysInMonth(next.year, next.month)))
}

/** First occurrence on or after `today`, stepping from `from`. */
export function rollForward(from: string, frequency: Frequency, anchorDay: number | null, today: string): string {
  let date = from
  for (let i = 0; i < 2000 && date < today; i++) date = nextRecurringDate(date, frequency, anchorDay)
  return date
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
}
