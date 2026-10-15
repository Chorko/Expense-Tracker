'use client'

import { useId, useState, useTransition } from 'react'
import {
  archiveCategory,
  createCategory,
  createCategoryGroup,
  deleteCategoryGroup,
  restoreCategory,
  updateCategory,
  updateCategoryGroup,
} from '@/app/actions/categories'
import { IconPicker, SwatchPicker } from '@/components/ui/Pickers'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AmountInput } from '@/components/ui/AmountInput'
import { Field } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/Toast'
import { CATEGORY_ICONS, GROUP_COLORS } from '@/lib/presets'
import { amountToInput, parseAmount } from '@/lib/format'

export type SettingsCategory = {
  id: string
  name: string
  icon: string
  monthly_budget_amount: number
  group_id: string | null
  parent_id: string | null
  is_active: boolean
}

export type SettingsGroup = { id: string; name: string; color_hex: string }

export function CategoryModal({
  category,
  parents,
  groups,
  hasChildren = false,
  defaultParentId,
  onClose,
}: {
  category?: SettingsCategory
  parents: Array<{ id: string; name: string; icon: string }>
  groups: SettingsGroup[]
  hasChildren?: boolean
  defaultParentId?: string
  onClose: () => void
}) {
  const id = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? '💰')
  const [budget, setBudget] = useState(category ? amountToInput(category.monthly_budget_amount) : '')
  const [groupId, setGroupId] = useState(category?.group_id ?? '')
  const [parentId, setParentId] = useState(category?.parent_id ?? defaultParentId ?? '')
  const [error, setError] = useState('')
  const [confirmArchive, setConfirmArchive] = useState(false)
  const icons = CATEGORY_ICONS.includes(icon) ? CATEGORY_ICONS : [icon, ...CATEGORY_ICONS]
  const parentOptions = parents.filter(p => p.id !== category?.id)

  function submit() {
    const value = budget.trim() === '' ? 0 : parseAmount(budget)
    if (!name.trim()) return setError('Give the category a name')
    if (value === null) return setError('Enter a valid monthly budget (or leave it empty for none)')
    setError('')
    const payload = {
      name,
      icon,
      monthly_budget_amount: value,
      group_id: groupId || null,
      parent_id: parentId || null,
    }
    startTransition(async () => {
      const result = category ? await updateCategory({ id: category.id, ...payload }) : await createCategory(payload)
      if (!result.success) return setError(result.error)
      toast.success(category ? 'Category saved' : `${name.trim()} added`)
      onClose()
    })
  }

  function restore() {
    if (!category) return
    startTransition(async () => {
      const result = await restoreCategory(category.id)
      if (!result.success) return setError(result.error)
      toast.success(`${category.name} restored`)
      onClose()
    })
  }

  return (
    <>
      <Modal
        title={category ? `Edit ${category.name}` : parentId ? 'New sub-category' : 'New category'}
        description={category ? undefined : 'It gets its own budget this month and a stack for unspent money.'}
        onClose={onClose}
        busy={pending}
        footer={
          <div className="flex w-full items-center gap-2">
            {category?.is_active && (
              <button type="button" className="btn btn-danger mr-auto" onClick={() => setConfirmArchive(true)} disabled={pending}>
                Archive
              </button>
            )}
            {category && !category.is_active && (
              <button type="button" className="btn btn-secondary mr-auto" onClick={restore} disabled={pending}>
                Restore
              </button>
            )}
            <button type="button" className="btn btn-ghost ml-auto" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form={id} className="btn btn-primary" disabled={pending}>
              {pending && <span className="spinner" aria-hidden="true" />}
              Save
            </button>
          </div>
        }
      >
        <form
          id={id}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_11rem]">
            <Field id={`${id}-name`} label="Name">
              <input id={`${id}-name`} className="input" value={name} maxLength={100} placeholder="e.g. Groceries" onChange={e => setName(e.target.value)} autoFocus />
            </Field>
            <Field id={`${id}-budget`} label="Monthly budget">
              <AmountInput id={`${id}-budget`} value={budget} onChange={setBudget} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id={`${id}-parent`}
              label="Sub-category of"
              hint={hasChildren ? 'This category has its own sub-categories, so it stays top level.' : undefined}
            >
              <select id={`${id}-parent`} className="input" value={parentId} onChange={e => setParentId(e.target.value)} disabled={hasChildren}>
                <option value="">Nothing (top level)</option>
                {parentOptions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`${id}-group`} label="Group" hint={parentId ? 'Sub-categories use their parent’s colour when empty.' : undefined}>
              <select id={`${id}-group`} className="input" value={groupId} onChange={e => setGroupId(e.target.value)}>
                <option value="">No group</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset>
            <legend className="input-label">Icon</legend>
            <IconPicker icons={icons} value={icon} onChange={setIcon} label="Category icon" />
          </fieldset>
          {category && category.monthly_budget_amount !== (parseAmount(budget) ?? 0) && category.is_active && (
            <p className="text-xs text-parchment-faint">The new amount applies to this month’s open budget and every month after it.</p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>
      {confirmArchive && category && (
        <ConfirmDialog
          title={`Archive ${category.name}?`}
          message={
            <>
              It disappears from budgets and pickers. Its history and stack money are kept, any unspent budget this month is
              released, its recurring expenses pause{hasChildren ? ' and its sub-categories are archived too' : ''}. You can
              restore it later.
            </>
          }
          confirmLabel="Archive"
          onConfirm={() => archiveCategory(category.id)}
          onClose={() => setConfirmArchive(false)}
          onDone={() => {
            toast.success(`${category.name} archived`)
            onClose()
          }}
        />
      )}
    </>
  )
}

export function GroupModal({ group, onClose }: { group?: SettingsGroup; onClose: () => void }) {
  const id = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(group?.name ?? '')
  const [color, setColor] = useState(group?.color_hex ?? GROUP_COLORS[0])
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function submit() {
    if (!name.trim()) return setError('Give the group a name')
    setError('')
    startTransition(async () => {
      const input = { name, color_hex: color }
      const result = group ? await updateCategoryGroup(group.id, input) : await createCategoryGroup(input)
      if (!result.success) return setError(result.error)
      toast.success(group ? 'Group saved' : 'Group created')
      onClose()
    })
  }

  return (
    <>
      <Modal
        title={group ? 'Edit group' : 'New group'}
        description="Groups colour-code related categories, e.g. Essentials or Investments."
        size="sm"
        onClose={onClose}
        busy={pending}
        footer={
          <div className="flex w-full items-center gap-2">
            {group && (
              <button type="button" className="btn btn-danger mr-auto" onClick={() => setConfirmDelete(true)} disabled={pending}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn-ghost ml-auto" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" form={id} className="btn btn-primary" disabled={pending}>
              Save
            </button>
          </div>
        }
      >
        <form
          id={id}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            submit()
          }}
        >
          <Field id={`${id}-name`} label="Name">
            <input id={`${id}-name`} className="input" value={name} maxLength={60} onChange={e => setName(e.target.value)} autoFocus />
          </Field>
          <fieldset>
            <legend className="input-label">Colour</legend>
            <SwatchPicker value={color} onChange={setColor} label="Group colour" />
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>
      {confirmDelete && group && (
        <ConfirmDialog
          title={`Delete the ${group.name} group?`}
          message="Its categories stay as they are, just without a group."
          onConfirm={() => deleteCategoryGroup(group.id)}
          onClose={() => setConfirmDelete(false)}
          onDone={() => {
            toast.success('Group deleted')
            onClose()
          }}
        />
      )}
    </>
  )
}
