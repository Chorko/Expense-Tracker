import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In — Ledger',
  description: 'Sign in to your Ledger account',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
