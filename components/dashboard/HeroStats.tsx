'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCurrency, pct } from '@/lib/utils/format'

interface HeroStatsProps {
  income: number
  totalSpent: number
  totalBudgeted: number
  month: string
  year: number
}

function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [displayed, setDisplayed] = useState(0)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const start = 0
    const end = value
    const duration = 800
    const startTime = performance.now()

    function step(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(start + (end - start) * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      }
    }

    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value])

  return (
    <span className="mono-number">
      {prefix}{displayed.toLocaleString('en-IN')}
    </span>
  )
}

export function HeroStats({ income, totalSpent, totalBudgeted, month, year }: HeroStatsProps) {
  const remaining = totalBudgeted - totalSpent
  const savingsRate = income > 0 ? Math.round(((income - totalSpent) / income) * 100) : 0
  const spentPct = pct(totalSpent, totalBudgeted)

  const stats = [
    {
      id: 'hero-income',
      label: 'Monthly Income',
      value: income,
      color: 'var(--brass)',
      icon: '₹',
    },
    {
      id: 'hero-spent',
      label: `Spent — ${month}`,
      value: totalSpent,
      color: spentPct > 90 ? 'var(--rust-light)' : spentPct > 70 ? 'var(--warning)' : 'var(--teal)',
      icon: '↗',
    },
    {
      id: 'hero-remaining',
      label: 'Remaining Budget',
      value: Math.max(0, remaining),
      color: remaining < 0 ? 'var(--rust)' : 'var(--success)',
      icon: '◎',
    },
    {
      id: 'hero-savings',
      label: 'Savings Rate',
      value: savingsRate,
      color: savingsRate > 20 ? 'var(--teal)' : savingsRate > 10 ? 'var(--warning)' : 'var(--rust)',
      suffix: '%',
      icon: '↑',
      raw: true,
    },
  ]

  return (
    <div className="stagger-children grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map(stat => (
        <div
          key={stat.id}
          id={stat.id}
          className="card relative overflow-hidden"
        >
          {/* Subtle glow accent */}
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              background: `radial-gradient(circle at top right, ${stat.color}, transparent 70%)`,
            }}
          />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-mono font-medium uppercase tracking-widest"
                style={{ color: 'var(--parchment-faint)' }}
              >
                {stat.label}
              </span>
              <span style={{ color: stat.color, opacity: 0.7, fontSize: '0.875rem' }}>
                {stat.icon}
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-bold" style={{ color: stat.color }}>
              {stat.raw ? (
                <span className="mono-number">
                  <AnimatedNumber value={stat.value} />
                  {stat.suffix}
                </span>
              ) : (
                <>
                  <span className="text-parchment-dim text-sm font-mono mr-0.5">₹</span>
                  <AnimatedNumber value={stat.value} />
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
