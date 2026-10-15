import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ResetPasswordForm } from './ResetPasswordForm'
import { getSessionUser } from '@/lib/data/session'

export const metadata: Metadata = { title: 'Choose a new password' }

export default async function ResetPasswordPage() {
  // Reached from a recovery link (the callback created a session) or from Settings
  const session = await getSessionUser()
  if (!session) redirect('/login?error=session_required&next=/reset-password')
  return <ResetPasswordForm email={session.email ?? ''} />
}
