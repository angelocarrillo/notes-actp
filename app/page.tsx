'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onSnapshot } from 'firebase/firestore'
import { useUser } from './components/AuthGate'
import { NotePage, PageHead, AddBtn, SectionLbl, N, noteA } from './components/NotesShell'
import { NoteCard } from './components/NoteCard'
import { ownedNotesQuery, type Note } from '@/lib/notes'

export default function HomePage() {
  const user   = useUser()
  const router = useRouter()
  const [notes, setNotes]   = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [folder, setFolder] = useState<string>('All')

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(ownedNotesQuery(user.uid), snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Note))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [user?.uid])

  const folders = useMemo(() => {
    const set = new Set<string>()
    notes.forEach(n => { if (n.folder.trim()) set.add(n.folder.trim()) })
    return ['All', ...Array.from(set).sort()]
  }, [notes])

  const shown = useMemo(
    () => folder === 'All' ? notes : notes.filter(n => n.folder.trim() === folder),
    [notes, folder],
  )

  return (
    <NotePage>
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>
        <PageHead
          eyebrow="Household"
          title="Notes"
          trail={<AddBtn onClick={() => router.push('/new')} />}
        />

        {/* Folder filter */}
        {folders.length > 1 && (
          <div style={{
            display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 4px',
            WebkitOverflowScrolling: 'touch',
          }}>
            {folders.map(f => {
              const active = f === folder
              return (
                <button key={f} onClick={() => setFolder(f)} style={{
                  flexShrink: 0, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: N.font,
                  padding: '7px 14px', borderRadius: 20,
                  border: `1px solid ${active ? noteA('88') : N.border}`,
                  background: active ? noteA('22') : 'transparent',
                  color: active ? N.text : N.textMut,
                }}>
                  {f}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ height: 14 }} />

        {loading ? (
          <p style={{ textAlign: 'center', color: N.textMut, fontSize: 13, marginTop: 40 }}>Loading…</p>
        ) : shown.length === 0 ? (
          <EmptyState onNew={() => router.push('/new')} filtered={folder !== 'All'} />
        ) : (
          <>
            <SectionLbl label={`${shown.length} note${shown.length > 1 ? 's' : ''}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 0' }}>
              {shown.map(n => (
                <NoteCard key={n.id} note={n} onClick={() => router.push(`/note/${n.id}`)} />
              ))}
            </div>
          </>
        )}
      </div>
    </NotePage>
  )
}

function EmptyState({ onNew, filtered }: { onNew: () => void; filtered: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 30px', color: N.textMut }}>
      <div style={{ fontFamily: N.bebas, fontSize: 28, color: N.textSec, letterSpacing: '0.04em' }}>
        {filtered ? 'Nothing here' : 'No notes yet'}
      </div>
      <p style={{ fontSize: 13, margin: '8px 0 20px' }}>
        {filtered ? 'No notes in this folder.' : 'Start with a blank note or a template.'}
      </p>
      {!filtered && (
        <button onClick={onNew} className="lg-press" style={{
          background: N.note, color: '#0a0a0c', border: 'none', borderRadius: 100,
          padding: '12px 22px', fontSize: 14, fontWeight: 700, fontFamily: N.font, cursor: 'pointer',
        }}>
          + New note
        </button>
      )}
    </div>
  )
}
