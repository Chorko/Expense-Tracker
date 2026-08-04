'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '◉' },
  { href: '/dashboard/transactions', label: 'Transactions', icon: '≡' },
  { href: '/dashboard/stacks', label: 'Stacks', icon: '⊞' },
  { href: '/dashboard/stocks', label: 'Stock Purchases', icon: '↗' },
  { href: '/dashboard/loans', label: 'Loans', icon: '🤝' },
  { href: '/dashboard/goals', label: 'Goals', icon: '◎' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙' },
]

interface SidebarProps {
  displayName: string
  email: string
}

export function Sidebar({ displayName, email }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-6">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-navy font-bold text-sm flex-shrink-0"
          style={{ background: 'var(--brass)' }}
          aria-hidden="true"
        >
          ₹
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-parchment text-sm leading-tight truncate">Ledger</p>
          <p className="text-parchment-faint text-xs truncate">{displayName || email}</p>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Main navigation">
        <p className="section-header mb-1">Navigation</p>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="w-4 text-center flex-shrink-0 font-mono" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="btn btn-ghost w-full text-rust hover:text-rust-light text-sm"
        id="sidebar-signout"
      >
        {signingOut ? '…' : '↩ Sign out'}
      </button>
    </aside>
  )
}
