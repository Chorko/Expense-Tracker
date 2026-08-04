import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ledger — Personal Finance Tracker',
  description: 'Multi-user personal finance tracker with category budgets, rollover stacks, and lending management.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-ink-navy text-parchment min-h-screen">
        {children}
      </body>
    </html>
  )
}
