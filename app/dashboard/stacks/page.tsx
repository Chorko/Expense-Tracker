import { getStackBalances, getStackHistory } from '@/app/actions/stacks'
import { getCategories } from '@/app/actions/categories'
import { StacksPageClient } from './StacksPageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stacks — Ledger',
  description: 'Your accumulated unused budget by category',
}

export default async function StacksPage() {
  const [stacks, history, categories] = await Promise.all([
    getStackBalances(),
    getStackHistory({ limit: 50 }),
    getCategories(),
  ])

  const now = new Date()
  const currentPeriods = categories.map(cat => ({
    category_id: cat.id,
    name: cat.name,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }))

  const stacksForModal = stacks
    .filter(s => s.categories?.id)
    .map(s => ({
      category_id: s.categories!.id,
      name: s.categories!.name,
      icon: s.categories!.icon,
      current_balance: s.current_balance,
    }))

  return (
    <StacksPageClient
      stacks={stacks}
      history={history}
      stacksForModal={stacksForModal}
      currentPeriods={currentPeriods}
    />
  )
}
