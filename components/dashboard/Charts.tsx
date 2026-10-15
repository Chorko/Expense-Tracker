'use client'

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/format'

export type Slice = { name: string; value: number; color: string }
export type TrendDatum = { label: string; budgeted: number; spent: number }

const tooltipStyle: React.CSSProperties = {
  background: 'var(--ink-navy-3)',
  border: '1px solid var(--line-strong)',
  borderRadius: 10,
  padding: '0.5rem 0.75rem',
  fontSize: '0.8125rem',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

type PieTooltipProps = { active?: boolean; payload?: Array<{ name?: string; value?: number; payload?: Slice }> }

function SliceTooltip({ active, payload }: PieTooltipProps) {
  const item = payload?.[0]
  if (!active || !item?.payload) return null
  return (
    <div style={tooltipStyle}>
      <p style={{ color: item.payload.color, fontWeight: 600 }}>{item.payload.name}</p>
      <p className="font-mono text-parchment">{formatCurrency(item.payload.value)}</p>
    </div>
  )
}

/** Donut + a text legend (the legend doubles as the accessible version). */
export function SpendingDonut({ data, total }: { data: Slice[]; total: number }) {
  if (data.length === 0 || total <= 0) {
    return <p className="flex h-48 items-center justify-center text-sm text-parchment-faint">No spending this month yet</p>
  }
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="relative h-44 w-44 shrink-0" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} strokeWidth={0}>
              {data.map(slice => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="eyebrow">Spent</span>
          <span className="mono-number text-sm font-semibold text-parchment">{formatCurrency(total, { compact: true })}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map(slice => (
          <li key={slice.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-parchment-dim">{slice.name}</span>
            <span className="font-mono text-xs text-parchment">{formatCurrency(slice.value)}</span>
            <span className="w-9 text-right font-mono text-xs text-parchment-faint">
              {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type BarTooltipProps = { active?: boolean; label?: string; payload?: Array<{ dataKey?: string | number; value?: number }> }

function TrendTooltip({ active, label, payload }: BarTooltipProps) {
  if (!active || !payload?.length) return null
  const get = (key: string) => payload.find(p => p.dataKey === key)?.value ?? 0
  return (
    <div style={tooltipStyle}>
      <p className="mb-1 font-semibold text-parchment">{label}</p>
      <p className="font-mono text-teal">Spent {formatCurrency(get('spent'))}</p>
      <p className="font-mono text-parchment-dim">Budget {formatCurrency(get('budgeted'))}</p>
    </div>
  )
}

export function TrendChart({ data }: { data: TrendDatum[] }) {
  if (data.length === 0) {
    return <p className="flex h-48 items-center justify-center text-sm text-parchment-faint">Not enough history yet</p>
  }
  return (
    <>
      <div className="h-52" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#8b8476', fontSize: 11 }} />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8b8476', fontSize: 11 }}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(201,168,76,0.06)' }} />
            <Bar dataKey="budgeted" fill="rgba(201,168,76,0.35)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="spent" fill="#2dd4bf" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Budget and spending per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Budget</th>
            <th scope="col">Spent</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{formatCurrency(d.budgeted)}</td>
              <td>{formatCurrency(d.spent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-center gap-4 text-xs text-parchment-faint" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(201,168,76,0.5)' }} /> Budget
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal" /> Spent
        </span>
      </div>
    </>
  )
}
