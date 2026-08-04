import { createClient } from '@/lib/supabase/server'
import { StocksPageClient } from './StocksPageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stock Purchases — Ledger',
}

export default async function StocksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: stocks } = await supabase
    .from('stock_purchases')
    .select('*')
    .eq('user_id', user.id)
    .order('purchase_date', { ascending: false })

  return <StocksPageClient stocks={stocks ?? []} />
}
