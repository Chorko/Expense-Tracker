import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { OnboardingClient } from './OnboardingClient'
import { getViewerWithoutSync } from '@/lib/data/session'
import { listTimezones } from '@/lib/dates'
import { toNumber } from '@/lib/format'

export const metadata: Metadata = { title: 'Set up your budget' }

export default async function OnboardingPage() {
  const viewer = await getViewerWithoutSync()
  if (viewer.profile.onboarded_at) redirect('/dashboard')

  return (
    <OnboardingClient
      defaultName={viewer.profile.display_name ?? ''}
      defaultIncome={toNumber(viewer.profile.monthly_income)}
      timezone={viewer.timezone}
      timezones={listTimezones(viewer.timezone)}
    />
  )
}
