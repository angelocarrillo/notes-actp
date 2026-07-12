import type { Metadata, Viewport } from 'next'
import './globals.css'
import AuthGate from './components/AuthGate'
import BottomNavWrapper from './components/BottomNavWrapper'
import { SearchProvider } from './components/SearchContext'

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
        {/* Mark the document as embedded BEFORE paint when running inside the AIO
            iframe, so globals.css can switch to the iframe-safe scroll-lock. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(window.self!==window.top){document.documentElement.setAttribute('data-embedded','1')}}catch(e){document.documentElement.setAttribute('data-embedded','1')}",
          }}
        />
        <AuthGate>
          <SearchProvider>
            {children}
            <BottomNavWrapper />
          </SearchProvider>
        </AuthGate>
      </body>
    </html>
  )
}
