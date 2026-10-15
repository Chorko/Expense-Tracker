import type { Metadata } from 'next'
import { StacksClient, type HistoryItem } from './StacksClient'
import { toCategoryMeta, toCategoryOptions, toStackOptions } from '@/lib/budget'
import { getViewer } from '@/lib/data/session'
import { getCategories } from '@/lib/data/categories'
import { getStackBalances } from '@/lib/data/budget'
import { getStackHistory, getStockPurchases } from '@/lib/data/stacks'
import { getGoals } from '@/lib/data/goals'
import { formatMonth } from '@/lib/dates'
import { roundMoney } from '@/lib/format'

export const metadata: Metadata = { title: 'Stacks' }

export default async function StacksPage() {
  const viewer = await getViewer()
  const [categories, stacks, history, goals, stocks] = await Promise.all([
    getCategories(),
    getStackBalances(),
    getStackHistory(300),
    getGoals(),
    getStockPurchases(),
  ])
  const meta = toCategoryMeta(categories)
  const goalNames = new Map(goals.map(g => [g.id, `${g.icon} ${g.name}`]))
  const stockNames = new Map(stocks.map(s => [s.id, s.ticker_or_note ?? 'Investment']))
  const nameOf = (id: string | null) => (id && meta[id] ? meta[id].label : 'a removed category')

  // Resolve ids to words on the server so the client stays simple
  const items: HistoryItem[] = history.map(row => {
    const signed = ['accrual', 'adjustment_in', 'reallocation_in'].includes(row.type) ? row.amount : -row.amount
    const period = row.month && row.year ? formatMonth({ year: row.year, month: row.month }) : null
    let title: string
    switch (row.type) {
      case 'accrual':
        title = `Unspent budget${period ? ` from ${period}` : ''}`
        break
      case 'adjustment_in':
      case 'adjustment_out':
        title = `Correction${period ? ` for ${period}` : ''}`
        break
      case 'reallocation_in':
        title = 'Moved in from other stacks'
        break
      case 'pulled_to_period':
        title = `Added to ${nameOf(row.related_category_id)} budget${period ? ` (${period})` : ''}`
        break
      default:
        title = row.related_goal_id
          ? `Saved to goal ${goalNames.get(row.related_goal_id) ?? ''}`.trim()
          : row.related_stock_purchase_id
            ? `Invested in ${stockNames.get(row.related_stock_purchase_id) ?? 'an investment'}`
            : row.related_category_id
              ? `Moved to ${nameOf(row.related_category_id)} stack`
              : 'Moved out'
    }
    return {
      id: row.id,
      categoryId: row.category_id,
      stackName: nameOf(row.category_id),
      icon: row.category_id && meta[row.category_id] ? meta[row.category_id].icon : '💰',
      type: row.type,
      title,
      comment: row.comment,
      amount: signed,
      createdAt: row.created_at,
    }
  })

  const stackOptions = toStackOptions(categories, stacks)
  return (
    <StacksClient
      stacks={stackOptions}
      total={roundMoney([...stacks.values()].reduce((s, v) => s + v, 0))}
      history={items}
      timezone={viewer.timezone}
      categoryOptions={toCategoryOptions(categories)}
      goalOptions={goals.map(g => ({ id: g.id, name: g.name, icon: g.icon }))}
    />
  )
}
