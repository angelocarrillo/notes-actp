'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onSnapshot } from 'firebase/firestore'
import { useUser } from '../components/AuthGate'
import { NotePage, PageHead, SectionLbl, N } from '../components/NotesShell'
import { NoteCard } from '../components/NoteCard'
import { sharedNotesQuery, type Note } from '@/lib/notes'

export default function SharedPage() {
  const user   = useUser()
  const router = useRouter()
  const [notes, setNotes]     = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) { setLoading(false); return }
    const unsub = onSnapshot(sharedNotesQuery(user.email), snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Note))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [user?.email])

  return (
    <NotePage>
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>
        <PageHead eyebrow="From others" title="Shared" />

        <div style={{ height: 18 }} />

        {loading ? (
          <p style={{ textAlign: 'center', color: N.textMut, fontSize: 13, marginTop: 40 }}>Loading…</p>
        ) : notes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 30px', color: N.textMut }}>
            <div style={{ fontFamily: N.bebas, fontSize: 28, color: N.textSec, letterSpacing: '0.04em' }}>Nothing shared yet</div>
            <p style={{ fontSize: 13, margin: '8px 0 0' }}>Notes other people share with your Google account will show up here.</p>
          </div>
        ) : (
          <>
            <SectionLbl label={`${notes.length} shared with you`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 0' }}>
              {notes.map(n => (
                <NoteCard
                  key={n.id}
                  note={n}
                  onClick={() => router.push(`/note/${n.id}`)}
                  subtitle={`from ${n.ownerEmail}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </NotePage>
  )
}
