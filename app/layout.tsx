import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

// Self-hosted at build time: no requests to Google from the browser
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Ledger — Personal finance tracker', template: '%s · Ledger' },
  description:
    'Envelope budgeting with rollover stacks, recurring expenses, savings goals and a lending tracker.',
  applicationName: 'Ledger',
}

export const viewport: Viewport = {
  themeColor: '#0d1117',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`dark ${plexSans.variable} ${plexMono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="font-sans antialiased bg-ink-navy text-parchment min-h-screen">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
