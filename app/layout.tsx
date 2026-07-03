import type { Metadata, Viewport } from 'next'
import './globals.css'
import AuthGate from './components/AuthGate'
import BottomNavWrapper from './components/BottomNavWrapper'

export const metadata: Metadata = {
  title: 'Notes',
  description: 'Household notes, lists & templates',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Notes' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0c',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGate>
          {children}
          <BottomNavWrapper />
        </AuthGate>
      </body>
    </html>
  )
}
