// View-model types shared by server pages and client components

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

export type CategoryOption = {
  id: string
  name: string
  icon: string
  parentId: string | null
  /** "Travel › Chennai" for sub-categories */
  label: string
}

export type GroupRef = { id: string; name: string; color: string }

export type BudgetFigures = {
  budgeted: number
  rolloverIn: number
  /** budgeted + rolloverIn */
  available: number
  spent: number
  /** available - spent (negative when overspent) */
  remaining: number
  stack: number
}

export type BudgetLine = BudgetFigures & {
  categoryId: string
  name: string
  icon: string
  parentId: string | null
  group: GroupRef | null
  isActive: boolean
  closed: boolean
  /** Own figures plus every sub-category */
  rollup: BudgetFigures
  children: BudgetLine[]
}

export type StackOption = {
  categoryId: string
  name: string
  icon: string
  balance: number
}

export type GoalOption = { id: string; name: string; icon: string }

/** Lookup data for labelling rows that reference a category (incl. archived) */
export type CategoryMeta = { id: string; name: string; icon: string; label: string; isActive: boolean; color: string | null }

export type TxnRow = {
  id: string
  amount: number
  description: string | null
  txn_date: string
  source: string
  category_id: string | null
  recurring_id: string | null
}

export type LoanRow = {
  id: string
  borrower_name: string
  amount: number
  direction: 'lent_out' | 'borrowed_in'
  date_lent: string
  reason: string | null
  expected_return_date: string | null
  reminder_date: string | null
  status: 'outstanding' | 'partially_repaid' | 'repaid'
  notes: string | null
  repaid: number
  outstanding: number
  repayments: Array<{ id: string; amount: number; repaid_date: string; notes: string | null }>
}

export type LoanSummary = {
  lentOutstanding: number
  borrowedOutstanding: number
  activeCount: number
  overdueCount: number
  nextReminder: { name: string; date: string } | null
}

export type GoalRow = {
  id: string
  name: string
  icon: string
  color_hex: string
  target_amount: number
  current_amount: number
  target_date: string | null
}
