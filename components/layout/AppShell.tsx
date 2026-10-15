'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { signOut } from '@/app/actions/profile'
import { TransactionModal } from '@/components/transactions/TransactionModal'
import type { CategoryOption } from '@/lib/types'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: '◉' },
  { href: '/dashboard/transactions', label: 'Transactions', icon: '≡' },
  { href: '/dashboard/stacks', label: 'Stacks', icon: '⊞' },
  { href: '/dashboard/goals', label: 'Goals', icon: '◎' },
  { href: '/dashboard/loans', label: 'Loans', icon: '⇄' },
  { href: '/dashboard/stocks', label: 'Investments', icon: '↗' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙' },
]

function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(`${href}/`)
}

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 px-1 min-w-0" aria-label="Ledger, go to overview">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold text-ink-navy"
        style={{ background: 'linear-gradient(135deg, var(--brass-light), var(--brass-dark))' }}
        aria-hidden="true"
      >
        ₹
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight text-parchment">Ledger</span>
        <span className="block truncate text-xs text-parchment-faint">{subtitle}</span>
      </span>
    </Link>
  )
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(item => {
        const active = isActive(pathname, item.href)
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="nav-item"
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
            >
              <span className="nav-icon font-mono" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="btn btn-ghost w-full justify-start text-parchment-dim hover:text-rust-light">
        <span aria-hidden="true">↩</span> Sign out
      </button>
    </form>
  )
}

type AppShellProps = {
  displayName: string
  email: string
  categories: CategoryOption[]
  today: string
  children: React.ReactNode
}

export function AppShell({ displayName, email, categories, today, children }: AppShellProps) {
  const pathname = usePathname()
  const drawerRef = useRef<HTMLDialogElement>(null)
  const [quickAdd, setQuickAdd] = useState(false)
  const subtitle = displayName || email

  function openDrawer() {
    drawerRef.current?.showModal()
  }
  function closeDrawer() {
    drawerRef.current?.close()
  }

  // Close the drawer whenever the route changes
  useEffect(() => {
    drawerRef.current?.close()
  }, [pathname])

  // "N" opens quick add from anywhere (unless typing in a field)
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return
      event.preventDefault()
      setQuickAdd(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar" aria-label="Sidebar">
        <div className="mb-5">
          <Brand subtitle={subtitle} />
        </div>
        <button type="button" className="btn btn-primary mb-4 w-full" onClick={() => setQuickAdd(true)}>
          + Add expense
          <kbd className="ml-auto rounded border border-ink-navy/25 px-1.5 text-[0.625rem] font-mono opacity-70">N</kbd>
        </button>
        <nav aria-label="Main">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="flex-1" />
        <SignOutButton />
      </aside>

      {/* Mobile top bar */}
      <header className="topbar">
        <button type="button" className="btn btn-ghost btn-icon" onClick={openDrawer} aria-label="Open menu">
          <span aria-hidden="true" className="text-lg">☰</span>
        </button>
        <Brand subtitle={subtitle} />
        <button
          type="button"
          className="btn btn-primary btn-icon"
          onClick={() => setQuickAdd(true)}
          aria-label="Add expense"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
        </button>
      </header>

      <dialog
        ref={drawerRef}
        className="drawer"
        aria-label="Menu"
        onClick={event => {
          if (event.target === event.currentTarget) closeDrawer()
        }}
      >
        <div className="flex items-center justify-between p-4">
          <Brand subtitle={subtitle} />
          <button type="button" className="btn btn-ghost btn-icon" onClick={closeDrawer} aria-label="Close menu">
            ✕
          </button>
        </div>
        <nav aria-label="Main" className="px-3">
          <NavLinks pathname={pathname} onNavigate={closeDrawer} />
        </nav>
        <div className="flex-1" />
        <div className="p-3">
          <SignOutButton />
        </div>
      </dialog>

      <div className="app-main">
        <main id="main-content" className="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      {quickAdd && (
        <TransactionModal categories={categories} today={today} onClose={() => setQuickAdd(false)} />
      )}
    </div>
  )
}
