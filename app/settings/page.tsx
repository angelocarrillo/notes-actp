'use client'
import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useUser } from '../components/AuthGate'
import { NotePage, PageHead, Glass, SectionLbl, N, noteA, ACCENT_THEMES, applyAccent, restoreAccent } from '../components/NotesShell'

export default function SettingsPage() {
  const user = useUser()
  const [accent, setAccent] = useState<string>('#8a7ad8')

  useEffect(() => {
    restoreAccent()
    try {
      const saved = localStorage.getItem('notes_accent')
      if (saved) setAccent(saved)
    } catch { /* ignore */ }
  }, [])

  const chooseAccent = (hex: string) => {
    setAccent(hex)
    applyAccent(hex)
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'prefs', 'notesAccent'), { hex }).catch(() => { /* ignore */ })
    }
  }

  const logout = () => { if (auth) signOut(auth) }

  return (
    <NotePage>
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>
        <PageHead eyebrow="Preferences" title="Settings" />

        <div style={{ height: 18 }} />

        {/* Account */}
        <SectionLbl label="Account" />
        <div style={{ padding: '12px 16px 0' }}>
          <Glass p={16} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: noteA('33'), color: N.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, textTransform: 'uppercase' }}>
              {(user?.email ?? '?')[0]}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: N.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.displayName ?? 'Signed in'}</div>
              <div style={{ fontSize: 12, color: N.textMut, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
          </Glass>
        </div>

        <div style={{ height: 22 }} />

        {/* Accent */}
        <SectionLbl label="Accent color" />
        <div style={{ padding: '12px 16px 0' }}>
          <Glass p={16}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {ACCENT_THEMES.map(t => {
                const active = t.hex.toLowerCase() === accent.toLowerCase()
                return (
                  <button key={t.hex} onClick={() => chooseAccent(t.hex)} aria-label={t.name} style={{
                    width: 42, height: 42, borderRadius: '50%', cursor: 'pointer',
                    background: t.hex, border: active ? '3px solid #fff' : '3px solid transparent',
                    boxShadow: active ? `0 0 0 2px ${t.hex}, 0 0 14px ${t.hex}aa` : 'none',
                  }} />
                )
              })}
            </div>
          </Glass>
        </div>

        <div style={{ height: 22 }} />

        {/* Sign out */}
        <div style={{ padding: '0 16px' }}>
          <button onClick={logout} style={{
            width: '100%', background: 'rgba(216,122,122,0.1)', border: `1px solid ${noteA('00')}`,
            borderColor: 'rgba(216,122,122,0.3)', borderRadius: 14, padding: '14px',
            color: N.warn, fontSize: 14, fontWeight: 600, fontFamily: N.font, cursor: 'pointer',
          }}>
            Sign out
          </button>
        </div>

        <p style={{ textAlign: 'center', color: N.textDim, fontSize: 11, marginTop: 24, fontFamily: N.mono }}>
          Household Notes · part of Joint AIO
        </p>
      </div>
    </NotePage>
  )
}
