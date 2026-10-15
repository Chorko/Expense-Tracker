import 'server-only'

import { cache } from 'react'
import { getViewer } from './session'
import { toNumber } from '@/lib/format'
import type { GoalRow } from '@/lib/types'

export const getGoals = cache(async (): Promise<GoalRow[]> => {
  const { supabase } = await getViewer()
  const { data, error } = await supabase
    .from('goals')
    .select('id, name, icon, color_hex, target_amount, current_amount, target_date')
    .order('created_at')
  if (error) throw new Error(`Could not load goals: ${error.message}`)
  return (data ?? []).map(g => ({
    ...g,
    target_amount: toNumber(g.target_amount),
    current_amount: toNumber(g.current_amount),
  }))
})
