import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard — Ledger',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single() as { data: { display_name: string | null } | null }

  return (
    <div className="dashboard-grid">
      <Sidebar
        displayName={profile?.display_name ?? ''}
        email={user.email ?? ''}
      />
      <main className="main-content" id="main-content">
        {children}
      </main>
    </div>
  )
}
