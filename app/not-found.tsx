import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="auth-container">
      <div className="text-center animate-fadeIn">
        <p className="font-mono text-6xl font-bold text-brass">404</p>
        <h1 className="mt-3 text-xl font-semibold text-parchment">This page is not in the ledger</h1>
        <p className="mt-2 text-sm text-parchment-dim">The link may be old or mistyped.</p>
        <Link href="/dashboard" className="btn btn-primary mt-6">
          Back to overview
        </Link>
      </div>
    </div>
  )
}
