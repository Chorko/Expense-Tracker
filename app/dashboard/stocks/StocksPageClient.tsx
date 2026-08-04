'use client'

import { formatCurrency, formatDate } from '@/lib/utils/format'

interface StockPurchase {
  id: string
  amount: number
  purchase_date: string
  ticker_or_note: string | null
  funded_from: Array<{ category_id?: string; category?: string; amount: number }> | null
  created_at: string
}

interface StocksPageClientProps {
  stocks: StockPurchase[]
}

export function StocksPageClient({ stocks }: StocksPageClientProps) {
  const totalInvested = stocks.reduce((s, st) => s + st.amount, 0)

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-parchment">Stock Purchases</h1>
        <p className="text-parchment-dim text-sm mt-0.5">
          Investments funded from your budget stacks
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">Total invested</p>
          <p className="font-mono font-bold text-2xl text-brass">{formatCurrency(totalInvested)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-parchment-faint uppercase tracking-widest mb-1">Purchases</p>
          <p className="font-mono font-bold text-2xl text-parchment">{stocks.length}</p>
        </div>
      </div>

      {stocks.length === 0 ? (
        <div className="card text-center py-12" style={{ borderStyle: 'dashed' }}>
          <span className="text-4xl mb-3 block">📈</span>
          <p className="text-parchment-dim mb-1">No stock purchases yet</p>
          <p className="text-parchment-faint text-sm">
            Use &ldquo;Move stack money&rdquo; and choose &ldquo;Fund stock purchase&rdquo; to log one
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="table-ledger">
            <thead>
              <tr>
                <th>Date</th>
                <th>Stock / Note</th>
                <th>Amount</th>
                <th>Funded from</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map(stock => (
                <tr key={stock.id}>
                  <td className="font-mono text-sm text-parchment-dim">
                    {formatDate(stock.purchase_date)}
                  </td>
                  <td>
                    <p className="font-medium text-parchment">
                      {stock.ticker_or_note ?? '—'}
                    </p>
                  </td>
                  <td className="amount font-mono font-semibold text-brass">
                    {formatCurrency(stock.amount)}
                  </td>
                  <td>
                    {stock.funded_from && Array.isArray(stock.funded_from) ? (
                      <div className="flex flex-wrap gap-1">
                        {stock.funded_from.map((f, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded-full font-mono"
                            style={{
                              background: 'rgba(45,212,191,0.1)',
                              color: 'var(--teal)',
                              border: '1px solid rgba(45,212,191,0.2)',
                            }}
                          >
                            {f.category ?? 'Unknown'}: {formatCurrency(f.amount)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-parchment-faint text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
