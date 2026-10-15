'use client'

import Link from 'next/link'
import { useId, useState, useTransition } from 'react'
import { reorderCategories } from '@/app/actions/categories'
import { signOut, updateProfile } from '@/app/actions/profile'
import { CategoryModal, GroupModal, type SettingsCategory, type SettingsGroup } from '@/components/categories/CategoryModals'
import { AmountInput } from '@/components/ui/AmountInput'
import { EmptyState, Field, PageHeader } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { amountToInput, formatCurrency, parseAmount, roundMoney } from '@/lib/format'

type Category = SettingsCategory & { sort_order: number }

type SettingsClientProps = {
  email: string
  profile: { display_name: string; monthly_income: number; timezone: string; email_reports_enabled: boolean }
  timezones: string[]
  categories: Category[]
  groups: SettingsGroup[]
}

type Dialog =
  | { kind: 'category'; category?: Category; parentId?: string }
  | { kind: 'group'; group?: SettingsGroup }

const byOrder = (a: Category, b: Category) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)

function ProfileForm({ profile, timezones }: Pick<SettingsClientProps, 'profile' | 'timezones'>) {
  const id = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(profile.display_name)
  const [income, setIncome] = useState(amountToInput(profile.monthly_income))
  const [timezone, setTimezone] = useState(profile.timezone)
  const [reports, setReports] = useState(profile.email_reports_enabled)
  const [error, setError] = useState('')

  function save(event: React.FormEvent) {
    event.preventDefault()
    const value = income.trim() === '' ? 0 : parseAmount(income)
    if (!name.trim()) return setError('Enter your name')
    if (value === null) return setError('Enter a valid monthly income')
    setError('')
    startTransition(async () => {
      const result = await updateProfile({ display_name: name, monthly_income: value, timezone, email_reports_enabled: reports })
      if (!result.success) return setError(result.error)
      toast.success('Profile saved')
    })
  }

  return (
    <form onSubmit={save} noValidate className="card space-y-4" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="section-title">
        Profile
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field id={`${id}-name`} label="Your name">
          <input id={`${id}-name`} className="input" value={name} maxLength={100} onChange={e => setName(e.target.value)} />
        </Field>
        <Field id={`${id}-income`} label="Monthly income" hint="Used for the savings rate and unassigned income.">
          <AmountInput id={`${id}-income`} value={income} onChange={setIncome} />
        </Field>
        <Field id={`${id}-tz`} label="Timezone" hint="Decides when your budget month starts and ends.">
          <select id={`${id}-tz`} className="input" value={timezone} onChange={e => setTimezone(e.target.value)}>
            {timezones.map(zone => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <label className="flex items-start gap-2.5 text-sm text-parchment">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--brass)]" checked={reports} onChange={e => setReports(e.target.checked)} />
            <span>
              E-mail me a monthly report
              <span className="block text-xs text-parchment-faint">Sent early each month for the month before.</span>
            </span>
          </label>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          Save profile
        </button>
      </div>
    </form>
  )
}

function CategoryRow({
  category,
  group,
  isChild,
  canMoveUp,
  canMoveDown,
  busy,
  onMove,
  onEdit,
  onAddChild,
}: {
  category: Category
  group?: SettingsGroup
  isChild: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  busy: boolean
  onMove: (delta: -1 | 1) => void
  onEdit: () => void
  onAddChild?: () => void
}) {
  return (
    <li className={`flex items-center gap-2 px-3 py-2.5 sm:px-4 ${isChild ? 'pl-9 sm:pl-12' : ''}`}>
      <div className="flex flex-col" aria-label={`Reorder ${category.name}`} role="group">
        <button
          type="button"
          className="px-1 text-xs leading-none text-parchment-faint hover:text-parchment disabled:opacity-25"
          onClick={() => onMove(-1)}
          disabled={!canMoveUp || busy}
          aria-label={`Move ${category.name} up`}
        >
          ▲
        </button>
        <button
          type="button"
          className="px-1 text-xs leading-none text-parchment-faint hover:text-parchment disabled:opacity-25"
          onClick={() => onMove(1)}
          disabled={!canMoveDown || busy}
          aria-label={`Move ${category.name} down`}
        >
          ▼
        </button>
      </div>
      <span className="text-lg" aria-hidden="true">
        {category.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-parchment">{category.name}</p>
        {group && (
          <p className="flex items-center gap-1.5 text-xs text-parchment-faint">
            <span className="h-2 w-2 rounded-full" style={{ background: group.color_hex }} aria-hidden="true" />
            {group.name}
          </p>
        )}
      </div>
      <span className="font-mono text-sm text-parchment-dim">{formatCurrency(category.monthly_budget_amount)}</span>
      {onAddChild && (
        <button type="button" className="btn btn-ghost btn-sm hidden sm:inline-flex" onClick={onAddChild} aria-label={`Add sub-category to ${category.name}`}>
          + Sub
        </button>
      )}
      <button type="button" className="btn btn-outline btn-sm" onClick={onEdit} aria-label={`Edit ${category.name}`}>
        Edit
      </button>
    </li>
  )
}

export function SettingsClient({ email, profile, timezones, categories, groups }: SettingsClientProps) {
  const toast = useToast()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [reordering, startReorder] = useTransition()

  const active = categories.filter(c => c.is_active)
  const activeIds = new Set(active.map(c => c.id))
  const parents = active.filter(c => !c.parent_id || !activeIds.has(c.parent_id)).sort(byOrder)
  const childrenOf = (id: string) => active.filter(c => c.parent_id === id).sort(byOrder)
  const archived = categories.filter(c => !c.is_active).sort(byOrder)
  const groupById = new Map(groups.map(g => [g.id, g]))
  const totalBudget = roundMoney(active.reduce((s, c) => s + c.monthly_budget_amount, 0))
  const unassigned = roundMoney(profile.monthly_income - totalBudget)
  const parentChoices = parents.map(p => ({ id: p.id, name: p.name, icon: p.icon }))

  function move(category: Category, delta: -1 | 1) {
    const isTop = parents.some(p => p.id === category.id)
    const siblings = isTop ? [...parents] : childrenOf(category.parent_id as string)
    const index = siblings.findIndex(s => s.id === category.id)
    const target = index + delta
    if (target < 0 || target >= siblings.length) return
    ;[siblings[index], siblings[target]] = [siblings[target], siblings[index]]

    const topOrder = isTop ? siblings : parents
    const order = topOrder.flatMap(parent => [
      parent.id,
      ...(!isTop && parent.id === category.parent_id ? siblings : childrenOf(parent.id)).map(c => c.id),
    ])
    startReorder(async () => {
      const result = await reorderCategories(order)
      if (!result.success) toast.error(result.error)
    })
  }

  return (
    <div className="animate-fadeIn space-y-6">
      <PageHeader title="Settings" subtitle="Your profile, budget categories and account" />

      <ProfileForm profile={profile} timezones={timezones} />

      <section id="categories" className="card card-flush scroll-mt-24" aria-labelledby="categories-title">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
          <div>
            <h2 id="categories-title" className="section-title">
              Budget categories
            </h2>
            <p className="mt-0.5 text-xs text-parchment-faint">
              {formatCurrency(totalBudget)} a month across {active.length} categories
              {profile.monthly_income > 0 &&
                (unassigned >= 0
                  ? ` · ${formatCurrency(unassigned)} of income unassigned`
                  : ` · ${formatCurrency(-unassigned)} more than your income`)}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDialog({ kind: 'group' })}>
              + Group
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialog({ kind: 'category' })}>
              + Category
            </button>
          </div>
        </div>
        {parents.length === 0 ? (
          <div className="px-4 pb-5">
            <EmptyState compact icon="🗂️" title="No categories yet" description="Add one for each kind of spending you want to budget." />
          </div>
        ) : (
          <ul className="divide-y divide-white/5 border-t border-white/5" aria-busy={reordering}>
            {parents.map((parent, i) => {
              const kids = childrenOf(parent.id)
              return [
                <CategoryRow
                  key={parent.id}
                  category={parent}
                  group={parent.group_id ? groupById.get(parent.group_id) : undefined}
                  isChild={false}
                  canMoveUp={i > 0}
                  canMoveDown={i < parents.length - 1}
                  busy={reordering}
                  onMove={delta => move(parent, delta)}
                  onEdit={() => setDialog({ kind: 'category', category: parent })}
                  onAddChild={() => setDialog({ kind: 'category', parentId: parent.id })}
                />,
                ...kids.map((child, j) => (
                  <CategoryRow
                    key={child.id}
                    category={child}
                    group={child.group_id ? groupById.get(child.group_id) : undefined}
                    isChild
                    canMoveUp={j > 0}
                    canMoveDown={j < kids.length - 1}
                    busy={reordering}
                    onMove={delta => move(child, delta)}
                    onEdit={() => setDialog({ kind: 'category', category: child })}
                  />
                )),
              ]
            })}
          </ul>
        )}
        {archived.length > 0 && (
          <div className="border-t border-white/5 p-4">
            <button type="button" className="text-sm text-parchment-dim hover:text-parchment" onClick={() => setShowArchived(v => !v)} aria-expanded={showArchived}>
              {showArchived ? '▾' : '▸'} Archived ({archived.length})
            </button>
            {showArchived && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {archived.map(c => (
                  <li key={c.id}>
                    <button type="button" className="chip" onClick={() => setDialog({ kind: 'category', category: c })}>
                      <span aria-hidden="true">{c.icon}</span> {c.name} · restore or edit
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="groups-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="groups-title" className="section-title">
            Groups
          </h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDialog({ kind: 'group' })}>
            + Group
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-parchment-dim">Groups colour-code your categories and split the spending chart. None yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {groups.map(group => (
              <li key={group.id}>
                <button type="button" className="chip" onClick={() => setDialog({ kind: 'group', group })} aria-label={`Edit group ${group.name}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.color_hex }} aria-hidden="true" />
                  {group.name}
                  <span className="text-parchment-faint">{active.filter(c => c.group_id === group.id).length}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="account-title">
        <h2 id="account-title" className="section-title mb-3">
          Account
        </h2>
        <p className="text-sm text-parchment-dim">
          Signed in as <span className="text-parchment">{email}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/reset-password" className="btn btn-outline btn-sm">
            Change password
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn btn-ghost btn-sm text-rust-light">
              Sign out
            </button>
          </form>
        </div>
      </section>

      {dialog?.kind === 'category' && (
        <CategoryModal
          category={dialog.category}
          parents={parentChoices}
          groups={groups}
          hasChildren={dialog.category ? categories.some(c => c.parent_id === dialog.category?.id) : false}
          defaultParentId={dialog.parentId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'group' && <GroupModal group={dialog.group} onClose={() => setDialog(null)} />}
    </div>
  )
}
