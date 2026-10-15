'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export function ErrorPanel({
  error,
  retry,
  homeHref = '/dashboard',
}: {
  error: Error & { digest?: string }
  retry: () => void
  homeHref?: string
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-lg py-16 text-center animate-fadeIn" role="alert">
      <span className="mb-4 block text-5xl" aria-hidden="true">
        🧾
      </span>
      <h1 className="text-xl font-semibold text-parchment">Something went wrong</h1>
      <p className="mt-2 text-sm text-parchment-dim">
        This page could not be loaded. Your data is safe. Try again, and if it keeps happening check your
        connection or the Supabase project status.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-parchment-faint">Reference: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          Try again
        </button>
        <Link href={homeHref} className="btn btn-outline">
          Go to overview
        </Link>
      </div>
    </div>
  )
}
