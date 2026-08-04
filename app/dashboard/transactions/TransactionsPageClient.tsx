'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTransaction } from '@/app/actions/transactions'
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal'
import { formatCurrency, formatDate } from '@/lib/utils/format'

interface Transaction {
  id: string
  amount: number
  description: string | null
  txn_date: string
  source: string
  categories: { name: string; icon: string | null } | null | Array<{ name: string; icon: string | null }>
}

interface Category {
  id: string
  name: string
  icon: string | null
}

interface TransactionsPageClientProps {
  transactions: Transaction[]
  categories: Category[]
  month: string
  year: number
}

export function TransactionsPageClient({
  transactions,
  categories,
  month,
  year,
}: TransactionsPageClientProps) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSuccess = useCallback(() => router.refresh(), [router])

  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0)

  const filtered = transactions.filter(t => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const desc = (t.description ?? '').toLowerCase()
    const catName = Array.isArray(t.categories)
      ? (t.categories[0]?.name ?? '').toLowerCase()
      : (t.categories?.name ?? '').toLowerCase()
    return desc.includes(q) || catName.includes(q)
  })

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    setDeletingId(id)
    await deleteTransaction(id)
    setDeletingId(null)
    router.refresh()
  }

  // Group by date
  const grouped = filtered.reduce<Record<string, Transaction[]>>((acc, txn) => {
    const date = txn.txn_date
    if (!acc[date]) acc[date] = []
    acc[date].push(txn)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort().reverse()

  function getCategoryInfo(txn: Transaction) {
    if (Array.isArray(txn.categories)) return txn.categories[0] ?? null
    return txn.categories
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-parchment">Transactions</h1>
          <p className="text-parchment-dim text-sm mt-0.5">
            {month} {year} — {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          id="btn-add-txn-page"
          onClick={() => setShowAdd(true)}
          className="btn btn-primary"
        >
          + Add transaction
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">Total spent</p>
          <p className="font-mono font-bold text-2xl text-brass">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">Transactions</p>
          <p className="font-mono font-bold text-2xl text-parchment">{transactions.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by description or category…"
          className="input"
          id="txn-search"
          aria-label="Search transactions"
        />
      </div>

      {/* Transactions by date */}
      {sortedDates.length === 0 ? (
        <div className="card text-center py-12" style={{ borderStyle: 'dashed' }}>
          <span className="text-4xl mb-3 block">📋</span>
          <p className="text-parchment-dim mb-1">
            {searchQuery ? 'No transactions match your search' : 'No transactions yet'}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowAdd(true)} className="btn btn-secondary mt-2 text-sm">
              + Add your first transaction
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sortedDates.map(date => (
            <div key={date}>
              <p className="text-xs font-mono text-parchment-faint uppercase tracking-widest mb-2">
                {formatDate(date)}
              </p>
              <div className="card p-0 overflow-hidden">
                <table className="table-ledger">
                  <tbody>
                    {grouped[date].map(txn => {
                      const cat = getCategoryInfo(txn)
                      return (
                        <tr key={txn.id} className="group">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-base" aria-hidden="true">
                                {cat?.icon ?? '💳'}
                              </span>
                              <div>
                                <p className="text-sm text-parchment">
                                  {txn.description || cat?.name || 'Uncategorised'}
                                </p>
                                {txn.description && cat?.name && (
                                  <p className="text-xs text-parchment-faint">{cat.name}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="text-right">
                            <span className="font-mono font-semibold text-sm amount-negative">
                              − {formatCurrency(txn.amount)}
                            </span>
                          </td>
                          <td className="w-8">
                            <button
                              onClick={() => handleDelete(txn.id)}
                              disabled={deletingId === txn.id}
                              className="btn btn-ghost p-1 text-rust opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                              aria-label={`Delete transaction`}
                            >
                              {deletingId === txn.id ? '…' : '✕'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddTransactionModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
