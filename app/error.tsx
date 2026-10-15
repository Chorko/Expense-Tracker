'use client'

import { ErrorPanel } from '@/components/ui/ErrorPanel'

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="auth-container">
      <ErrorPanel error={error} retry={retry} homeHref="/" />
    </div>
  )
}
