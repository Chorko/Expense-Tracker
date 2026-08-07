'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { categorySchema } from '@/lib/validations'
import { getCurrentMonthYear } from '@/lib/utils/format'
import type { CategoryInput } from '@/lib/validations'

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function createCategory(raw: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const catResult = await (supabase as any)
    .from('categories')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      monthly_budget_amount: parsed.data.monthly_budget_amount,
      group_id: parsed.data.group_id ?? null,
      parent_id: parsed.data.parent_id ?? null,
      is_flexible: parsed.data.is_flexible,
      icon: parsed.data.icon,
    })
    .select('id')
    .single()

  if (catResult.error || !catResult.data) {
    console.error('createCategory error:', catResult.error)
    return { success: false, error: 'Failed to create category' }
  }

  const cat = catResult.data as { id: string }
  const { month, year } = getCurrentMonthYear()

  await (supabase as any).from('category_stacks').upsert(
    { user_id: user.id, category_id: cat.id, current_balance: 0 },
    { onConflict: 'user_id,category_id', ignoreDuplicates: true }
  )

  await (supabase as any).from('category_periods').upsert(
    {
      user_id: user.id,
      category_id: cat.id,
      month,
      year,
      budgeted_amount: parsed.data.monthly_budget_amount,
    },
    { onConflict: 'user_id,category_id,month,year', ignoreDuplicates: true }
  )

  revalidatePath('/dashboard')
  return { success: true, data: { id: cat.id } }
}

export async function updateCategory(
  categoryId: string,
  raw: Partial<CategoryInput>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await (supabase as any)
    .from('categories')
    .update(raw)
    .eq('id', categoryId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Failed to update category' }

  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

export async function getCategories() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await (supabase as any)
    .from('categories')
    .select(`
      id, name, monthly_budget_amount, is_flexible, is_active, icon, group_id, parent_id,
      category_groups (id, name, color_hex, sort_order)
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name')

  if (error) return []

  return (data ?? []) as Array<{
    id: string
    name: string
    monthly_budget_amount: number
    is_flexible: boolean
    is_active: boolean
    icon: string | null
    group_id: string | null
    parent_id: string | null
    category_groups: { id: string; name: string; color_hex: string; sort_order: number } | null
  }>
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await (supabase as any)
    .from('categories')
    .update({ is_active: false })
    .eq('id', categoryId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Failed to delete category' }

  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

export async function createCategoryGroup(
  name: string,
  colorHex: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (!name.trim()) return { success: false, error: 'Group name required' }
  if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) return { success: false, error: 'Invalid color' }

  const result = await (supabase as any)
    .from('category_groups')
    .insert({ user_id: user.id, name: name.trim(), color_hex: colorHex })
    .select('id')
    .single()

  if (result.error || !result.data) return { success: false, error: 'Failed to create group' }

  revalidatePath('/dashboard/settings')
  return { success: true, data: { id: (result.data as { id: string }).id } }
}

export async function updateProfile(opts: {
  display_name?: string
  monthly_income?: number
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const updates: Record<string, unknown> = {}
  if (opts.display_name !== undefined) {
    const trimmed = opts.display_name.trim()
    if (!trimmed) return { success: false, error: 'Display name cannot be empty' }
    updates.display_name = trimmed
  }
  if (opts.monthly_income !== undefined) {
    if (opts.monthly_income < 0) return { success: false, error: 'Income cannot be negative' }
    updates.monthly_income = opts.monthly_income
  }

  const { error } = await (supabase as any)
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return { success: false, error: 'Failed to update profile' }

  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

type DashboardProfile = {
  id: string
  display_name: string | null
  monthly_income: number
  currency: string
}

type DashboardPeriod = {
  id: string
  month: number
  year: number
  budgeted_amount: number
  rollover_in: number
  spent_amount: number
  closed: boolean
  categories: {
    id: string
    name: string
    icon: string | null
    monthly_budget_amount: number
    group_id: string | null
    parent_id: string | null
    category_groups: { name: string; color_hex: string } | null
  } | null
  category_stacks: { current_balance: number } | null
}

type Goal = {
  id: string
  name: string
  target_amount: number
  current_amount: number
  color_hex: string
  target_date: string | null
}

export async function getDashboardData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { month, year } = getCurrentMonthYear()

  const [profileRes, periodsRes, goalsRes] = await Promise.all([
    (supabase as any).from('profiles').select('*').eq('id', user.id).single(),
    (supabase as any)
      .from('category_periods')
      .select(`
        id, month, year, budgeted_amount, rollover_in, spent_amount, closed,
        categories (
          id, name, icon, monthly_budget_amount, group_id, parent_id,
          category_groups (name, color_hex)
        ),
        category_stacks (current_balance)
      `)
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year),
    (supabase as any)
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at'),
  ])

  return {
    profile: profileRes.data as DashboardProfile | null,
    periods: (periodsRes.data ?? []) as DashboardPeriod[],
    goals: (goalsRes.data ?? []) as Goal[],
    month,
    year,
  }
}

const CUSTOM_PRESET_22 = [
  { name: 'Rent', icon: '🏠', amount: 9500 },
  { name: 'Food', icon: '🍽️', amount: 5000 },
  { name: 'Grocery', icon: '🛒', amount: 500 },
  { name: 'Subscriptions', icon: '📱', amount: 1500 },
  { name: 'Chennai travel', icon: '🚌', amount: 2000 },
  { name: 'Domestic travel', icon: '✈️', amount: 500 },
  { name: 'Family support', icon: '👨‍👩‍👧', amount: 4000 },
  { name: 'Church', icon: '⛪', amount: 1000 },
  { name: "Parents' health insurance", icon: '🏥', amount: 3000 },
  { name: 'Term insurance (yourself)', icon: '🛡️', amount: 300 },
  { name: 'OPD / routine medical buffer', icon: '💊', amount: 350 },
  { name: 'SIP — Nifty 50 (core)', icon: '📈', amount: 3520 },
  { name: 'SIP — Nifty Next 50', icon: '📊', amount: 1280 },
  { name: 'SIP — Nasdaq 100 FoF', icon: '🌐', amount: 1600 },
  { name: 'Personal RD @ 7.25%', icon: '🏦', amount: 3450 },
  { name: 'Growth — SIP/Bond (fund TBD)', icon: '🌱', amount: 250 },
  { name: 'EF safety top-up (→ liquid fund)', icon: '🛟', amount: 500 },
  { name: 'Entertainment', icon: '🎬', amount: 2000 },
  { name: 'Shopping', icon: '🛍️', amount: 1500 },
  { name: 'Misc', icon: '📦', amount: 1000 },
  { name: 'Annual one-off sinking fund (→ Oct RD)', icon: '🏺', amount: 1250 },
  { name: 'Gifts sinking fund', icon: '🎁', amount: 1000 },
]

export async function seedPresetCategories(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { month, year } = getCurrentMonthYear()

  for (const item of CUSTOM_PRESET_22) {
    const { data: existing } = await (supabase as any)
      .from('categories')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', item.name)
      .single()

    let catId = existing?.id

    if (!catId) {
      const { data: newCat } = await (supabase as any)
        .from('categories')
        .insert({
          user_id: user.id,
          name: item.name,
          monthly_budget_amount: item.amount,
          icon: item.icon,
          is_flexible: false,
          is_active: true,
        })
        .select('id')
        .single()
      if (newCat) catId = newCat.id
    } else {
      await (supabase as any)
        .from('categories')
        .update({ monthly_budget_amount: item.amount, icon: item.icon, is_active: true })
        .eq('id', catId)
    }

    if (catId) {
      await (supabase as any).from('category_periods').upsert(
        {
          user_id: user.id,
          category_id: catId,
          month,
          year,
          budgeted_amount: item.amount,
        },
        { onConflict: 'user_id,category_id,month,year' }
      )

      await (supabase as any).from('category_stacks').upsert(
        { user_id: user.id, category_id: catId, current_balance: 0 },
        { onConflict: 'user_id,category_id' }
      )
    }
  }

  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}
