'use client'

import { useState, useTransition } from 'react'
import { createCategory, updateCategory, deleteCategory } from '@/app/actions/categories'
import { formatCurrency } from '@/lib/utils/format'

interface Category {
  id: string
  name: string
  monthly_budget_amount: number
  icon: string | null
  parent_id: string | null
}

interface CategoryManageModalProps {
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}

export function CategoryManageModal({
  categories,
  onClose,
  onSuccess,
}: CategoryManageModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'list' | 'create'>('list')


  // Create form state
  const [name, setName] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [icon, setIcon] = useState('💰')
  const [parentId, setParentId] = useState<string>('')

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmountStr, setEditAmountStr] = useState('')

  const parentCategories = categories.filter(c => !c.parent_id)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Category name required'); return }
    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount < 0) { setError('Valid budget amount required'); return }
    setError('')

    startTransition(async () => {
      const res = await createCategory({
        name: name.trim(),
        monthly_budget_amount: amount,
        icon: icon || '💰',
        parent_id: parentId || null,
        is_flexible: false,
      })

      if (!res.success) { setError(res.error); return }

      setName('')
      setAmountStr('')
      setParentId('')
      setMode('list')
      onSuccess()
    })
  }

  function handleSaveEdit(catId: string) {
    const amount = parseFloat(editAmountStr)
    if (isNaN(amount) || amount < 0) return
    setError('')

    startTransition(async () => {
      const res = await updateCategory(catId, { monthly_budget_amount: amount })
      if (!res.success) { setError(res.error); return }
      setEditingId(null)
      onSuccess()
    })
  }

  function handleDelete(catId: string, catName: string) {
    if (!confirm(`Are you sure you want to remove "${catName}"?`)) return
    startTransition(async () => {
      const res = await deleteCategory(catId)
      if (!res.success) { setError(res.error); return }
      onSuccess()
    })
  }

  const totalBudget = categories.reduce((sum, c) => sum + c.monthly_budget_amount, 0)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '640px' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-parchment">Category &amp; Sub-category Manager</h2>
            <p className="text-xs text-parchment-dim mt-0.5">
              Add new categories, create sub-categories, or adjust monthly budgets
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-1.5" aria-label="Close modal">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            {error}
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('list')}
            className={`btn text-xs flex-1 ${mode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
          >
            📋 Manage Categories ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`btn text-xs flex-1 ${mode === 'create' ? 'btn-primary' : 'btn-ghost'}`}
          >
            + Add New / Sub-Category
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate} id="create-category-form" className="animate-fadeIn">
            <div className="mb-4">
              <label htmlFor="cat-name" className="input-label">Category Name</label>
              <input
                id="cat-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input"
                placeholder="e.g. SIP — Nifty 50 or Emergency Fund"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label htmlFor="cat-amount" className="input-label">Monthly Budget (₹)</label>
                <input
                  id="cat-amount"
                  type="number"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="input font-mono"
                  placeholder="5000"
                  min="0"
                  step="1"
                  required
                />
              </div>

              <div>
                <label htmlFor="cat-icon" className="input-label">Icon / Emoji</label>
                <input
                  id="cat-icon"
                  type="text"
                  value={icon}
                  onChange={e => setIcon(e.target.value)}
                  className="input"
                  placeholder="💰"
                  maxLength={5}
                />
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="cat-parent" className="input-label">
                Parent Category <span className="text-parchment-faint text-[0.625rem] font-normal normal-case">(Optional — select to create a sub-category)</span>
              </label>
              <select
                id="cat-parent"
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                className="input"
              >
                <option value="">None (Standalone Parent Category)</option>
                {parentCategories.map(p => (
                  <option key={p.id} value={p.id}>
                    Sub-category of: {p.icon} {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setMode('list')} className="btn btn-ghost flex-1">
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-teal flex-2"
                style={{ flex: 2 }}
                disabled={isPending}
              >
                {isPending ? 'Saving…' : '+ Add Category'}
              </button>
            </div>
          </form>
        ) : (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-3 text-xs text-parchment-faint">
              <span>Category List</span>
              <span className="font-mono">Total Monthly Budget: <strong className="text-brass">{formatCurrency(totalBudget)}</strong></span>
            </div>

            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {categories.map(cat => {
                const isSub = !!cat.parent_id
                const parent = isSub ? parentCategories.find(p => p.id === cat.parent_id) : null

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border transition-all"
                    style={{
                      background: isSub ? 'var(--ink-navy-3)' : 'var(--ink-navy)',
                      borderColor: 'rgba(255,255,255,0.06)',
                      marginLeft: isSub ? '1.5rem' : '0',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{cat.icon || '💰'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-parchment truncate">
                          {cat.name}
                        </p>
                        {parent && (
                          <p className="text-[0.625rem] text-teal font-mono">
                            ↳ Sub-category of {parent.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {editingId === cat.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editAmountStr}
                            onChange={e => setEditAmountStr(e.target.value)}
                            className="input font-mono text-right"
                            style={{ width: '80px', padding: '0.2rem 0.4rem', fontSize: '0.8125rem' }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(cat.id)}
                            className="btn btn-teal text-xs py-1 px-2"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingId(cat.id); setEditAmountStr(String(cat.monthly_budget_amount)) }}
                          className="font-mono text-sm font-semibold text-brass hover:underline"
                          title="Click to edit budget"
                        >
                          {formatCurrency(cat.monthly_budget_amount)}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="btn btn-ghost p-1 text-rust text-xs hover:bg-rust/10"
                        title="Remove category"
                        aria-label={`Remove ${cat.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
