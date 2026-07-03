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
