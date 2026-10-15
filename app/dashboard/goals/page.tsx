import type { Metadata } from 'next'
import { GoalsClient } from './GoalsClient'
import { toCategoryOptions, toStackOptions } from '@/lib/budget'
import { getViewer } from '@/lib/data/session'
import { getCategories } from '@/lib/data/categories'
import { getStackBalances } from '@/lib/data/budget'
import { getGoals } from '@/lib/data/goals'

export const metadata: Metadata = { title: 'Goals' }

export default async function GoalsPage() {
  const viewer = await getViewer()
  const [goals, categories, stacks] = await Promise.all([getGoals(), getCategories(), getStackBalances()])
  return (
    <GoalsClient
      goals={goals}
      today={viewer.today}
      stacks={toStackOptions(categories, stacks)}
      categoryOptions={toCategoryOptions(categories)}
    />
  )
}
