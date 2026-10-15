import 'server-only'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { firstError } from '@/lib/validations'
import type { ActionResult } from '@/lib/types'
import type { ZodError } from 'zod'

type DbError = { code?: string; message: string; details?: string | null; hint?: string | null }

/** The verified caller for a Server Action, or null when signed out. */
export async function getActor() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || !userId) return null
  return { supabase, userId }
}

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function done(): ActionResult {
  return { success: true, data: undefined }
}

export function fail(error: string): { success: false; error: string } {
  return { success: false, error }
}

export const notSignedIn = () => fail('Your session has expired. Please sign in again.')

export function invalid(error: ZodError) {
  return fail(firstError(error))
}

/**
 * Turns a database error into something safe to show. Messages raised by our
 * own triggers/functions (P0001, and FK checks with custom text) are already
 * written for people; anything else is logged and replaced.
 */
export function dbFail(context: string, error: DbError) {
  const code = error.code ?? ''
  if (code === 'P0001') return fail(error.message)
  if (code === '23503' && !/violates foreign key/i.test(error.message)) return fail(error.message)
  if (code === '42501') return fail('You do not have access to that.')
  if (code === '23505') return fail('That already exists.')
  if (code === '23514') return fail('Some of those values are out of range.')
  console.error(`[${context}]`, code, error.message, error.details ?? '')
  return fail('Something went wrong. Please try again.')
}

/** Re-render every dashboard route (layout included: it lists categories). */
export function refreshDashboard() {
  revalidatePath('/dashboard', 'layout')
}
