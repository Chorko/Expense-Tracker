import { getLoans } from '@/app/actions/loans'
import { LoansPageClient } from './LoansPageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Loans — Ledger',
  description: 'Track money lent to friends and family',
}

export default async function LoansPage() {
  const loans = await getLoans({ includeRepaid: false })

  const today = new Date().toISOString().slice(0, 10)
  const totalOutstanding = loans.reduce((sum, loan) => {
    const repaid = loan.loan_repayments.reduce((s, r) => s + r.amount, 0)
    return sum + (loan.amount - repaid)
  }, 0)

  return (
    <LoansPageClient
      loans={loans}
      totalOutstanding={totalOutstanding}
      today={today}
    />
  )
}
