'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

interface StackOverviewProps {
  data: Array<{
    name: string
    balance: number
    icon?: string | null
    color?: string
  }>
  onCategoryClick?: (name: string) => void
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--ink-navy-3)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '0.625rem 0.875rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <p className="text-xs text-parchment-dim mb-1">{label}</p>
      <p className="font-mono font-semibold text-teal">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function StackOverviewPanel({ data, onCategoryClick }: StackOverviewProps) {
  if (!data.length) {
    return (
      <div
        className="card text-center py-8"
        style={{ borderStyle: 'dashed', borderColor: 'rgba(201,168,76,0.2)' }}
      >
        <p className="text-parchment-dim text-sm mb-1">No stack balances yet</p>
        <p className="text-parchment-faint text-xs">
          Unused budget accumulates here at month-end
        </p>
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.balance, 0)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-parchment text-sm">Stack Balances</h3>
          <p className="text-parchment-faint text-xs">Unused budget accumulated per category</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-parchment-faint uppercase tracking-widest text-[0.625rem]">Total</p>
          <p className="font-mono font-semibold text-teal">{formatCurrency(total)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(data.length * 40, 120)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 0, left: 8, bottom: 0 }}
          onClick={e => {
            if (e?.activeLabel !== undefined && onCategoryClick) {
              onCategoryClick(String(e.activeLabel))
            }
          }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="rgba(255,255,255,0.04)"
          />
          <XAxis
            type="number"
            tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
            tick={{ fill: 'var(--parchment-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'var(--parchment-dim)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="balance" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color ?? 'var(--teal)'}
                opacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
