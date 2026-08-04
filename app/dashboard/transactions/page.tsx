import type { Metadata } from 'next'
import { getTransactions } from '@/app/actions/transactions'
import { getCategories } from '@/app/actions/categories'
import { TransactionsPageClient } from './TransactionsPageClient'
import { MONTH_NAMES } from '@/lib/utils/format'

export const metadata: Metadata = {
  title: 'Transactions — Ledger',
}

export default async function TransactionsPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [transactions, categories] = await Promise.all([
    getTransactions({ month, year }),
    getCategories(),
  ])

  return (
    <TransactionsPageClient
      transactions={transactions as any}
      categories={categories as any}
      month={MONTH_NAMES[month - 1]}
      year={year}
    />
  )
}
