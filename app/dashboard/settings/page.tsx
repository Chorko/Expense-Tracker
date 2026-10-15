import type { Metadata } from 'next'
import { SettingsClient } from './SettingsClient'
import { getViewer } from '@/lib/data/session'
import { getCategories, getCategoryGroups } from '@/lib/data/categories'
import { listTimezones } from '@/lib/dates'
import { toNumber } from '@/lib/format'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const viewer = await getViewer()
  const [categories, groups] = await Promise.all([getCategories(), getCategoryGroups()])

  return (
    <SettingsClient
      email={viewer.email ?? ''}
      profile={{
        display_name: viewer.profile.display_name ?? '',
        monthly_income: toNumber(viewer.profile.monthly_income),
        timezone: viewer.timezone,
        email_reports_enabled: viewer.profile.email_reports_enabled,
      }}
      timezones={listTimezones(viewer.timezone)}
      categories={categories.map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon ?? '💰',
        monthly_budget_amount: toNumber(c.monthly_budget_amount),
        group_id: c.group_id,
        parent_id: c.parent_id,
        is_active: c.is_active,
        sort_order: c.sort_order,
      }))}
      groups={groups.map(g => ({ id: g.id, name: g.name, color_hex: g.color_hex }))}
    />
  )
}
