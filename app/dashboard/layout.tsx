import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/AppShell'
import { getViewer } from '@/lib/data/session'
import { getCategories } from '@/lib/data/categories'
import { toCategoryOptions } from '@/lib/budget'

export const metadata: Metadata = { title: { default: 'Overview', template: '%s · Ledger' } }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer()
  if (!viewer.profile.onboarded_at) redirect('/onboarding')
  const categories = await getCategories()

  return (
    <AppShell
      displayName={viewer.profile.display_name ?? ''}
      email={viewer.email ?? ''}
      categories={toCategoryOptions(categories)}
      today={viewer.today}
    >
      {children}
    </AppShell>
  )
}
