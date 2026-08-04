import { z } from 'zod'

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactionSchema = z.object({
  category_id: z.string().uuid('Invalid category').nullable().optional(),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(10_000_000, 'Amount too large'),
  description: z
    .string()
    .max(500, 'Description too long')
    .optional()
    .transform(v => v?.trim()),
  txn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
})

export type TransactionInput = z.infer<typeof transactionSchema>

// ─── Categories ───────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name required')
    .max(100, 'Name too long')
    .transform(v => v.trim()),
  monthly_budget_amount: z
    .number()
    .nonnegative('Budget must be non-negative')
    .max(10_000_000),
  group_id: z.string().uuid().nullable().optional(),
  is_flexible: z.boolean().optional().default(false),
  icon: z.string().max(10).optional().default('💰'),
})

export type CategoryInput = z.infer<typeof categorySchema>

// ─── Stack Reallocation ────────────────────────────────────────────────────────

export const stackReallocationSourceSchema = z.object({
  category_id: z.string().uuid('Invalid category'),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(10_000_000),
})

export const stackReallocationSchema = z.object({
  sources: z
    .array(stackReallocationSourceSchema)
    .min(1, 'Select at least one source'),
  dest_type: z.enum(['stack', 'period', 'stock']),
  dest_category_id: z.string().uuid().optional(),
  dest_period_month: z.number().int().min(1).max(12).optional(),
  dest_period_year: z.number().int().min(2000).optional(),
  ticker_or_note: z.string().max(200).optional(),
  comment: z
    .string()
    .min(1, 'Comment is required — explain why you are moving this money')
    .max(500, 'Comment too long')
    .transform(v => v.trim()),
}).refine(data => {
  if (data.dest_type === 'stock') return true
  return !!data.dest_category_id
}, { message: 'Destination category required', path: ['dest_category_id'] })

export type StackReallocationInput = z.infer<typeof stackReallocationSchema>

// ─── Loans ────────────────────────────────────────────────────────────────────

export const loanSchema = z.object({
  borrower_name: z
    .string()
    .min(1, 'Borrower name required')
    .max(200, 'Name too long')
    .transform(v => v.trim()),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(10_000_000),
  date_lent: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).optional().transform(v => v?.trim()),
  expected_return_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  reminder_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(1000).optional().transform(v => v?.trim()),
})

export type LoanInput = z.infer<typeof loanSchema>

export const loanRepaymentSchema = z.object({
  loan_id: z.string().uuid(),
  amount: z
    .number()
    .positive('Repayment amount must be positive')
    .max(10_000_000),
  repaid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional().transform(v => v?.trim()),
})

export type LoanRepaymentInput = z.infer<typeof loanRepaymentSchema>

export const snoozeLoanSchema = z.object({
  loan_id: z.string().uuid(),
  new_reminder_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// ─── Profile ──────────────────────────────────────────────────────────────────

export const profileSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name required')
    .max(100)
    .transform(v => v.trim()),
  monthly_income: z
    .number()
    .nonnegative('Income must be non-negative')
    .max(100_000_000),
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(320)
    .transform(v => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
})

export const registerSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Username required')
    .max(50)
    .regex(/^[a-zA-Z0-9_\- ]+$/, 'Username can only contain letters, numbers, spaces, hyphens and underscores')
    .transform(v => v.trim()),
  email: z
    .string()
    .email('Invalid email address')
    .max(320)
    .transform(v => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

// ─── Goals ────────────────────────────────────────────────────────────────────

export const goalSchema = z.object({
  name: z.string().min(1).max(200).transform(v => v.trim()),
  target_amount: z.number().positive().max(100_000_000),
  current_amount: z.number().nonnegative().optional().default(0),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  color_hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color')
    .optional()
    .default('#2dd4bf'),
})

export type GoalInput = z.infer<typeof goalSchema>
