import type { Metadata } from 'next'
import { StocksClient } from './StocksClient'
import { toCategoryMeta, toCategoryOptions, toStackOptions } from '@/lib/budget'
import { getViewer } from '@/lib/data/session'
import { getCategories } from '@/lib/data/categories'
import { getStackBalances } from '@/lib/data/budget'
import { getStockPurchases } from '@/lib/data/stacks'
import { getGoals } from '@/lib/data/goals'

export const metadata: Metadata = { title: 'Investments' }

export default async function StocksPage() {
  const viewer = await getViewer()
  const [purchases, categories, stacks, goals] = await Promise.all([
    getStockPurchases(),
    getCategories(),
    getStackBalances(),
    getGoals(),
  ])
  const meta = toCategoryMeta(categories)

  return (
    <StocksClient
      today={viewer.today}
      purchases={purchases.map(p => ({
        ...p,
        funded_from: p.funded_from.map(f => ({
          ...f,
          // Prefer the current name; fall back to the name saved at purchase time
          label: (f.category_id && meta[f.category_id]?.label) || f.category || 'Unknown stack',
          icon: (f.category_id && meta[f.category_id]?.icon) || '💰',
        })),
      }))}
      stacks={toStackOptions(categories, stacks)}
      categoryOptions={toCategoryOptions(categories)}
      goalOptions={goals.map(g => ({ id: g.id, name: g.name, icon: g.icon }))}
    />
  )
}
