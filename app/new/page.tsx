'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '../components/AuthGate'
import { NotePage, PageHead, Glass, N } from '../components/NotesShell'
import { TEMPLATES, seedNote } from '@/lib/templates'
import { createNote, type NoteType } from '@/lib/notes'

export default function NewNotePage() {
  const user   = useUser()
  const router = useRouter()
  const [busy, setBusy] = useState<NoteType | null>(null)

  const pick = async (type: NoteType) => {
    if (!user || busy) return
    setBusy(type)
    try {
      const id = await createNote(user.uid, user.email ?? '', seedNote(type))
      router.replace(`/note/${id}`)
    } catch (e) {
      console.error('Create note failed', e)
      setBusy(null)
    }
  }

  return (
    <NotePage>
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>
        <PageHead eyebrow="Create" title="New Note" back />

        <p style={{ color: N.textMut, fontSize: 13, padding: '10px 20px 6px' }}>
          Pick a starting point. You can rename and organize it after.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 16px 0' }}>
          {TEMPLATES.map(t => (
            <Glass key={t.type} onClick={() => pick(t.type)} accent={t.accent} p={16}
              style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: busy && busy !== t.type ? 0.5 : 1 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `color-mix(in srgb, ${t.accent} 20%, transparent)`,
                border: `1px solid color-mix(in srgb, ${t.accent} 42%, transparent)`,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke={t.accent} strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                  {t.icon.split(' M').map((d, j) => <path key={j} d={j === 0 ? d : 'M' + d} />)}
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: N.text }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: N.textMut }}>{t.blurb}</div>
              </div>
              <div style={{ color: N.textDim, flexShrink: 0 }}>
                {busy === t.type ? (
                  <span style={{ fontSize: 11, color: N.textMut, fontFamily: N.mono }}>…</span>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                )}
              </div>
            </Glass>
          ))}
        </div>
      </div>
    </NotePage>
  )
}
