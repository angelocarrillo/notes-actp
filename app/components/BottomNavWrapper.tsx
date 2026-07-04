'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { BottomNav, applyAccent, restoreAccent } from './NotesShell'
import { useUser } from './AuthGate'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Full-screen routes that hide the bottom nav (the note editor uses the space).
const HIDDEN_PREFIXES = ['/note/']

export default function BottomNavWrapper() {
  const pathname = usePathname()
  const user     = useUser()
  const hidden   = HIDDEN_PREFIXES.some(p => pathname?.startsWith(p))

  // Restore the saved accent on mount (localStorage), then sync from Firestore —
  // needed when the app runs inside the AIO iframe, where Safari ITP blocks
  // localStorage for third-party origins.
  useEffect(() => { restoreAccent() }, [])

  // When embedded in the AIO iframe, tell the parent which page we're on so it
  // only shows its "Return to AIO" header on our home page (full screen elsewhere).
  useEffect(() => {
    if (typeof window === 'undefined' || window.self === window.top) return
    try { window.parent.postMessage({ type: 'aio-nav', isHome: pathname === '/' }, '*') } catch { /* ignore */ }
  }, [pathname])

  // The AIO parent forwards the device's bottom safe-area inset (a cross-origin
  // iframe reads env(safe-area-inset-bottom) as 0). Expose it as a CSS var so the
  // bottom-nav pill can clear the home indicator when embedded.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'aio-safe' && typeof e.data.safeBottom === 'number') {
        document.documentElement.style.setProperty('--aio-safe-bottom', `${e.data.safeBottom}px`)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid, 'prefs', 'notesAccent')).then(snap => {
      if (snap.exists()) {
        const hex = snap.data().hex as string
        if (hex) applyAccent(hex)
      }
    }).catch(() => { /* ignore — localStorage fallback already applied */ })
  }, [user?.uid])

  if (hidden) return null
  return <BottomNav />
}
