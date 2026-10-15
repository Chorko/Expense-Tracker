import 'server-only'

import { cache } from 'react'
import { getViewer } from './session'
import type { Tables } from '@/types/database'

export type CategoryGroup = Tables<'category_groups'>

export type Category = Pick<
  Tables<'categories'>,
  | 'id'
  | 'name'
  | 'icon'
  | 'monthly_budget_amount'
  | 'is_active'
  | 'is_flexible'
  | 'parent_id'
  | 'group_id'
  | 'sort_order'
> & { group: Pick<CategoryGroup, 'id' | 'name' | 'color_hex'> | null }

/** Every category, including archived ones (needed to label history). */
export const getCategories = cache(async (): Promise<Category[]> => {
  const { supabase } = await getViewer()
  const { data, error } = await supabase
    .from('categories')
    .select(
      'id, name, icon, monthly_budget_amount, is_active, is_flexible, parent_id, group_id, sort_order, group:category_groups(id, name, color_hex)'
    )
    .order('sort_order')
    .order('name')
  if (error) throw new Error(`Could not load categories: ${error.message}`)
  return data ?? []
})

export const getCategoryGroups = cache(async (): Promise<CategoryGroup[]> => {
  const { supabase } = await getViewer()
  const { data, error } = await supabase
    .from('category_groups')
    .select('*')
    .order('sort_order', { nullsFirst: false })
    .order('name')
  if (error) throw new Error(`Could not load category groups: ${error.message}`)
  return data ?? []
})
