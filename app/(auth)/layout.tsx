import type { Metadata } from 'next'

export const metadata: Metadata = {
  // An object (not a string) so the root "%s · Ledger" template keeps applying
  title: { default: 'Account', template: '%s · Ledger' },
  description: 'Sign in to Ledger, your personal budget with rollover stacks.',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
