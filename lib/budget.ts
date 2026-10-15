// Pure helpers that turn database rows into budget view models
import { roundMoney, toNumber } from '@/lib/format'
import type { BudgetFigures, BudgetLine, CategoryMeta, CategoryOption, GroupRef, StackOption } from '@/lib/types'

export type CategoryLike = {
  id: string
  name: string
  icon: string | null
  parent_id: string | null
  is_active: boolean
  sort_order: number
  monthly_budget_amount: number
  group: { id: string; name: string; color_hex: string } | null
}

export type PeriodLike = {
  category_id: string
  budgeted_amount: number
  rollover_in: number
  spent_amount: number
  closed: boolean
}

const byOrder = (a: CategoryLike, b: CategoryLike) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)

/** Active categories, parents first with their sub-categories right after. */
export function toCategoryOptions(categories: CategoryLike[]): CategoryOption[] {
  const active = categories.filter(c => c.is_active).sort(byOrder)
  const ids = new Set(active.map(c => c.id))
  const options: CategoryOption[] = []
  for (const parent of active.filter(c => !c.parent_id || !ids.has(c.parent_id))) {
    const icon = parent.icon ?? '💰'
    options.push({ id: parent.id, name: parent.name, icon, parentId: null, label: parent.name })
    for (const child of active.filter(c => c.parent_id === parent.id)) {
      options.push({
        id: child.id,
        name: child.name,
        icon: child.icon ?? icon,
        parentId: parent.id,
        label: `${parent.name} › ${child.name}`,
      })
    }
  }
  return options
}

export function emptyFigures(): BudgetFigures {
  return { budgeted: 0, rolloverIn: 0, available: 0, spent: 0, remaining: 0, stack: 0 }
}

export function addFigures(a: BudgetFigures, b: BudgetFigures): BudgetFigures {
  return {
    budgeted: roundMoney(a.budgeted + b.budgeted),
    rolloverIn: roundMoney(a.rolloverIn + b.rolloverIn),
    available: roundMoney(a.available + b.available),
    spent: roundMoney(a.spent + b.spent),
    remaining: roundMoney(a.remaining + b.remaining),
    stack: roundMoney(a.stack + b.stack),
  }
}

function toGroup(group: CategoryLike['group']): GroupRef | null {
  return group ? { id: group.id, name: group.name, color: group.color_hex } : null
}

/**
 * Budget lines for one month. Categories appear when they have a period in
 * that month (or, for the live month, whenever they are active). Archived
 * categories only appear if money moved through them. Sub-categories are
 * nested under their parent and rolled up into `rollup`.
 */
export function buildBudgetLines(
  categories: CategoryLike[],
  periods: PeriodLike[],
  stacks: Map<string, number>,
  opts: { isLiveMonth: boolean }
): BudgetLine[] {
  const periodByCategory = new Map(periods.map(p => [p.category_id, p]))
  const lines = new Map<string, BudgetLine>()

  for (const category of [...categories].sort(byOrder)) {
    const period = periodByCategory.get(category.id)
    if (!period && !(opts.isLiveMonth && category.is_active)) continue

    const budgeted = toNumber(period ? period.budgeted_amount : category.monthly_budget_amount)
    const rolloverIn = toNumber(period?.rollover_in)
    const spent = toNumber(period?.spent_amount)
    if (!category.is_active && spent === 0 && rolloverIn === 0) continue

    const available = roundMoney(budgeted + rolloverIn)
    const figures: BudgetFigures = {
      budgeted,
      rolloverIn,
      available,
      spent,
      remaining: roundMoney(available - spent),
      stack: toNumber(stacks.get(category.id)),
    }
    lines.set(category.id, {
      ...figures,
      categoryId: category.id,
      name: category.name,
      icon: category.icon ?? '💰',
      parentId: category.parent_id,
      group: toGroup(category.group),
      isActive: category.is_active,
      closed: period?.closed ?? false,
      rollup: figures,
      children: [],
    })
  }

  const top: BudgetLine[] = []
  for (const line of lines.values()) {
    const parent = line.parentId ? lines.get(line.parentId) : undefined
    if (parent) parent.children.push(line)
    else top.push(line)
  }
  for (const line of top) {
    line.rollup = line.children.reduce((acc, child) => addFigures(acc, child), {
      budgeted: line.budgeted,
      rolloverIn: line.rolloverIn,
      available: line.available,
      spent: line.spent,
      remaining: line.remaining,
      stack: line.stack,
    })
    // A child inherits its parent's group colour when it has none
    for (const child of line.children) child.group ??= line.group
  }
  return top
}

export function totalFigures(lines: BudgetLine[]): BudgetFigures {
  return lines.reduce((acc, line) => addFigures(acc, line.rollup), emptyFigures())
}

/** Health of a budget line, used for colours and badges. */
export function budgetStatus(f: Pick<BudgetFigures, 'available' | 'spent'>): 'over' | 'warning' | 'ok' | 'idle' {
  if (f.available <= 0) return f.spent > 0 ? 'over' : 'idle'
  const ratio = f.spent / f.available
  if (ratio > 1.0001) return 'over'
  if (ratio >= 0.85) return 'warning'
  return 'ok'
}

/** id -> display data for every category, archived ones included. */
export function toCategoryMeta(categories: CategoryLike[]): Record<string, CategoryMeta> {
  const byId = new Map(categories.map(c => [c.id, c]))
  const meta: Record<string, CategoryMeta> = {}
  for (const c of categories) {
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined
    meta[c.id] = {
      id: c.id,
      name: c.name,
      icon: c.icon ?? parent?.icon ?? '💰',
      label: parent ? `${parent.name} › ${c.name}` : c.name,
      isActive: c.is_active,
      color: c.group?.color_hex ?? parent?.group?.color_hex ?? null,
    }
  }
  return meta
}

/** Stacks that hold money, largest first (archived categories keep theirs). */
export function toStackOptions(categories: CategoryLike[], stacks: Map<string, number>): StackOption[] {
  const meta = toCategoryMeta(categories)
  return [...stacks.entries()]
    .filter(([id, balance]) => balance > 0 && meta[id])
    .map(([id, balance]) => ({
      categoryId: id,
      name: meta[id].isActive ? meta[id].label : `${meta[id].label} (archived)`,
      icon: meta[id].icon,
      balance,
    }))
    .sort((a, b) => b.balance - a.balance)
}
