'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

interface DonutChartProps {
  data: Array<{
    name: string
    value: number
    color: string
  }>
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) => {
  if (!active || !payload?.length) return null
  const { name, value, payload: item } = payload[0]
  return (
    <div
      style={{
        background: 'var(--ink-navy-3)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '0.625rem 0.875rem',
        fontSize: '0.8125rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ color: item.color, fontWeight: 600, marginBottom: '2px' }}>{name}</div>
      <div style={{ color: 'var(--parchment)', fontFamily: 'var(--font-mono)' }}>
        {formatCurrency(value)}
      </div>
    </div>
  )
}

const CustomLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => {
  if (!payload) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-xs text-parchment-dim">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: entry.color }}
          />
          {entry.value}
        </div>
      ))}
    </div>
  )
}

export function DonutChart({ data }: DonutChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-parchment-faint text-sm">
        No spending data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
          animationBegin={0}
          animationDuration={800}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  )
}
