import { z } from 'zod'
import { isValidTimezone, isYmd } from '@/lib/dates'
import { roundMoney } from '@/lib/format'

// ─── Building blocks ─────────────────────────────────────────────────────────

const id = (message = 'Invalid id') => z.guid(message)
const ymd = (message = 'Enter a valid date') => z.string().refine(isYmd, message)
// Budget months must fall in 2001-2100 (category_periods.year check)
const bookingDate = (message = 'Enter a valid date') =>
  ymd(message).refine(v => v >= '2001-01-01' && v <= '2100-12-31', 'Pick a date between 2001 and 2100')

const money = (label = 'Amount', max = 10_000_000) =>
  z
    .number({ error: `${label} must be a number` })
    .positive(`${label} must be more than zero`)
    .max(max, `${label} is too large`)
    .transform(roundMoney)

const optionalText = (max: number, label = 'Text') =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (max ${max} characters)`)
    .optional()
    .nullable()
    .transform(v => (v ? v : null))

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid colour')
const emoji = z.string().trim().min(1, 'Pick an icon').max(16, 'Icon is too long')

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Please check the form and try again'
}

// ─── Transactions ────────────────────────────────────────────────────────────

export const transactionSchema = z.object({
  category_id: id('Pick a category').nullable(),
  amount: money(),
  description: optionalText(500, 'Description'),
  txn_date: bookingDate(),
})
export type TransactionInput = z.input<typeof transactionSchema>

export const transactionUpdateSchema = transactionSchema.extend({ id: id() })
export type TransactionUpdateInput = z.input<typeof transactionUpdateSchema>

export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const
export type Frequency = (typeof FREQUENCIES)[number]

export const recurringSchema = z.object({
  category_id: id('Pick a category').nullable(),
  amount: money(),
  description: optionalText(500, 'Description'),
  frequency: z.enum(FREQUENCIES, 'Pick how often it repeats'),
  next_due_date: bookingDate('Enter the next due date'),
})
export type RecurringInput = z.input<typeof recurringSchema>

export const recurringUpdateSchema = recurringSchema.extend({ id: id(), is_active: z.boolean() })
export type RecurringUpdateInput = z.input<typeof recurringUpdateSchema>

// ─── Categories ──────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  monthly_budget_amount: z
    .number({ error: 'Budget must be a number' })
    .min(0, 'Budget cannot be negative')
    .max(10_000_000, 'Budget is too large')
    .transform(roundMoney),
  group_id: id('Invalid group').nullable().optional(),
  parent_id: id('Invalid parent category').nullable().optional(),
  is_flexible: z.boolean().optional(),
  icon: emoji.optional(),
})
export type CategoryInput = z.input<typeof categorySchema>

export const categoryUpdateSchema = categorySchema.partial().extend({ id: id() })
export type CategoryUpdateInput = z.input<typeof categoryUpdateSchema>

export const categoryGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(60, 'Group name is too long'),
  color_hex: hexColor,
})
export type CategoryGroupInput = z.input<typeof categoryGroupSchema>

// ─── Stacks ──────────────────────────────────────────────────────────────────

export const STACK_DESTINATIONS = ['period', 'stack', 'stock', 'goal'] as const
export type StackDestination = (typeof STACK_DESTINATIONS)[number]

export const stackMoveSchema = z
  .object({
    sources: z
      .array(z.object({ category_id: id('Invalid source stack'), amount: money() }))
      .min(1, 'Choose at least one stack to take money from')
      .max(50, 'Too many source stacks'),
    dest_type: z.enum(STACK_DESTINATIONS, 'Choose where the money goes'),
    dest_category_id: id('Choose a destination category').nullable().optional(),
    dest_goal_id: id('Choose a goal').nullable().optional(),
    ticker_or_note: optionalText(200, 'Stock name'),
    comment: z
      .string()
      .trim()
      .min(1, 'Add a short note explaining this move')
      .max(500, 'Note is too long (max 500 characters)'),
  })
  .superRefine((value, ctx) => {
    if ((value.dest_type === 'period' || value.dest_type === 'stack') && !value.dest_category_id) {
      ctx.addIssue({ code: 'custom', message: 'Choose a destination category', path: ['dest_category_id'] })
    }
    if (value.dest_type === 'goal' && !value.dest_goal_id) {
      ctx.addIssue({ code: 'custom', message: 'Choose a goal', path: ['dest_goal_id'] })
    }
    if (value.dest_type === 'stock' && !value.ticker_or_note) {
      ctx.addIssue({ code: 'custom', message: 'Enter the stock or fund name', path: ['ticker_or_note'] })
    }
    const ids = value.sources.map(s => s.category_id)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'Each stack can only be used once', path: ['sources'] })
    }
    if (value.dest_type === 'stack' && value.dest_category_id && ids.includes(value.dest_category_id)) {
      ctx.addIssue({ code: 'custom', message: 'A stack cannot move money to itself', path: ['dest_category_id'] })
    }
  })
export type StackMoveInput = z.input<typeof stackMoveSchema>

export const stockNoteSchema = z.object({
  id: id(),
  ticker_or_note: z.string().trim().min(1, 'Enter a name').max(200, 'Name is too long'),
})

// ─── Loans ───────────────────────────────────────────────────────────────────

export const LOAN_DIRECTIONS = ['lent_out', 'borrowed_in'] as const
export type LoanDirection = (typeof LOAN_DIRECTIONS)[number]

export const loanSchema = z.object({
  borrower_name: z.string().trim().min(1, 'Enter a name').max(200, 'Name is too long'),
  amount: money(),
  direction: z.enum(LOAN_DIRECTIONS),
  date_lent: ymd(),
  reason: optionalText(500, 'Reason'),
  expected_return_date: ymd('Enter a valid due date').nullable().optional(),
  reminder_date: ymd('Enter a valid reminder date').nullable().optional(),
  notes: optionalText(1000, 'Notes'),
})
export type LoanInput = z.input<typeof loanSchema>

export const loanUpdateSchema = loanSchema.extend({ id: id() })
export type LoanUpdateInput = z.input<typeof loanUpdateSchema>

export const loanRepaymentSchema = z.object({
  loan_id: id(),
  amount: money('Repayment'),
  repaid_date: ymd(),
  notes: optionalText(500, 'Notes'),
})
export type LoanRepaymentInput = z.input<typeof loanRepaymentSchema>

export const loanReminderSchema = z.object({
  loan_id: id(),
  reminder_date: ymd('Enter a valid reminder date').nullable(),
})

// ─── Goals ───────────────────────────────────────────────────────────────────

export const goalSchema = z.object({
  name: z.string().trim().min(1, 'Name your goal').max(100, 'Name is too long'),
  target_amount: money('Target', 100_000_000),
  target_date: ymd('Enter a valid target date').nullable().optional(),
  color_hex: hexColor,
  icon: emoji,
})
export type GoalInput = z.input<typeof goalSchema>

export const goalUpdateSchema = goalSchema.extend({ id: id() })
export type GoalUpdateInput = z.input<typeof goalUpdateSchema>

export const goalAdjustSchema = z.object({
  goal_id: id(),
  amount: money('Amount', 100_000_000),
  direction: z.enum(['add', 'withdraw']),
})
export type GoalAdjustInput = z.input<typeof goalAdjustSchema>

// ─── Profile & onboarding ────────────────────────────────────────────────────

const displayName = z.string().trim().min(1, 'Enter your name').max(100, 'Name is too long')
const income = z
  .number({ error: 'Income must be a number' })
  .min(0, 'Income cannot be negative')
  .max(100_000_000, 'Income is too large')
  .transform(roundMoney)
const timezone = z.string().refine(isValidTimezone, 'Pick a valid timezone')

export const profileSchema = z.object({
  display_name: displayName,
  monthly_income: income,
  timezone,
  email_reports_enabled: z.boolean(),
})
export type ProfileInput = z.input<typeof profileSchema>

export const onboardingSchema = z.object({
  display_name: displayName,
  monthly_income: income,
  timezone,
  groups: z
    .array(z.object({ key: z.string().min(1).max(40), name: z.string().trim().min(1).max(60), color_hex: hexColor }))
    .max(20),
  categories: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Every category needs a name').max(100, 'Category name is too long'),
        icon: emoji,
        monthly_budget_amount: z.number().min(0).max(10_000_000).transform(roundMoney),
        group_key: z.string().max(40).nullable(),
      })
    )
    .max(80, 'That is a lot of categories (max 80)'),
})
export type OnboardingInput = z.input<typeof onboardingSchema>

// ─── Auth ────────────────────────────────────────────────────────────────────

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(320))

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password needs at least one uppercase letter')
  .regex(/[a-z]/, 'Password needs at least one lowercase letter')
  .regex(/[0-9]/, 'Password needs at least one number')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password').max(128),
})

export const registerSchema = z
  .object({
    display_name: displayName,
    email,
    password: strongPassword,
    confirm_password: z.string(),
  })
  .refine(d => d.password === d.confirm_password, { message: 'Passwords do not match', path: ['confirm_password'] })

export const emailOnlySchema = z.object({ email })

export const newPasswordSchema = z
  .object({ password: strongPassword, confirm_password: z.string() })
  .refine(d => d.password === d.confirm_password, { message: 'Passwords do not match', path: ['confirm_password'] })
