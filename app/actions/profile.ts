'use server'

import { redirect } from 'next/navigation'
import { dbFail, done, getActor, invalid, notSignedIn, refreshDashboard } from '@/lib/actions'
import { createClient } from '@/lib/supabase/server'
import { onboardingSchema, profileSchema, type OnboardingInput, type ProfileInput } from '@/lib/validations'
import type { ActionResult } from '@/lib/types'

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()

  const { error } = await actor.supabase.from('profiles').update(parsed.data).eq('id', actor.userId)
  if (error) return dbFail('updateProfile', error)

  // A timezone change can move "today" into another month
  const sync = await actor.supabase.rpc('sync_my_periods')
  if (sync.error) console.error('sync after updateProfile failed:', sync.error.message)

  refreshDashboard()
  return done()
}

/**
 * Saves the profile and creates the starting budget. Safe to submit twice:
 * categories are only created for an account that has none yet.
 */
export async function completeOnboarding(input: OnboardingInput): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const actor = await getActor()
  if (!actor) return notSignedIn()
  const { supabase, userId } = actor
  const { display_name, monthly_income, timezone, groups, categories } = parsed.data

  // Timezone first: new categories open "this month" in the user's timezone
  const profile = await supabase
    .from('profiles')
    .upsert({ id: userId, display_name, monthly_income, timezone }, { onConflict: 'id' })
  if (profile.error) return dbFail('completeOnboarding.profile', profile.error)

  const { count, error: countError } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
  if (countError) return dbFail('completeOnboarding.count', countError)

  if (!count && categories.length > 0) {
    // Only create groups that a chosen category actually uses
    const usedKeys = new Set(categories.map(c => c.group_key).filter(Boolean))
    const seenNames = new Set<string>()
    const wanted = groups.filter(g => {
      const name = g.name.toLowerCase()
      if (!usedKeys.has(g.key) || seenNames.has(name)) return false
      seenNames.add(name)
      return true
    })

    const groupIds = new Map<string, string>()
    if (wanted.length > 0) {
      const { data, error } = await supabase
        .from('category_groups')
        .insert(wanted.map((g, i) => ({ user_id: userId, name: g.name, color_hex: g.color_hex, sort_order: i + 1 })))
        .select('id, name')
      if (error) return dbFail('completeOnboarding.groups', error)
      for (const g of wanted) {
        const row = data?.find(r => r.name === g.name)
        if (row) groupIds.set(g.key, row.id)
      }
    }

    const { error } = await supabase.from('categories').insert(
      categories.map((c, i) => ({
        user_id: userId,
        name: c.name,
        icon: c.icon,
        monthly_budget_amount: c.monthly_budget_amount,
        group_id: c.group_key ? groupIds.get(c.group_key) ?? null : null,
        sort_order: (i + 1) * 10,
      }))
    )
    if (error) return dbFail('completeOnboarding.categories', error)
  }

  const finish = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId)
  if (finish.error) return dbFail('completeOnboarding.finish', finish.error)

  refreshDashboard()
  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
