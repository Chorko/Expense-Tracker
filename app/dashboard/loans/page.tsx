import type { Metadata } from 'next'
import { LoansClient } from './LoansClient'
import { getViewer } from '@/lib/data/session'
import { getLoans, summarizeLoans } from '@/lib/data/loans'

export const metadata: Metadata = { title: 'Loans' }

export default async function LoansPage() {
  const viewer = await getViewer()
  const loans = await getLoans()
  return <LoansClient loans={loans} summary={summarizeLoans(loans, viewer.today)} today={viewer.today} />
}
