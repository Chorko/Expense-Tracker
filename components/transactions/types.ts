import type { Frequency } from '@/lib/validations'

/** Recurring rule as shown in the UI (mirrors lib/data/transactions RecurringRule). */
export type RecurringRuleView = {
  id: string
  category_id: string | null
  amount: number
  description: string | null
  frequency: Frequency
  next_due_date: string
  last_posted_date: string | null
  is_active: boolean
}
