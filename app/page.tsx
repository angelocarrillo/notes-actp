'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onSnapshot } from 'firebase/firestore'
import { useUser } from './components/AuthGate'
import { NotePage, PageHead, AddBtn, SectionLbl, N, noteA } from './components/NotesShell'
import { useSearch } from './components/SearchContext'
import { NoteCard } from './components/NoteCard'
import { ownedNotesQuery, sharedNotesQuery, sortByUpdated, noteMatchesSearch, type Note } from '@/lib/notes'

export default function HomePage() {
  const user   = useUser()
  const router = useRouter()
  const { query } = useSearch()

  const [myNotes, setMyNotes]         = useState<Note[]>([])
  const [sharedNotes, setSharedNotes] = useState<Note[]>([])
  const [loadingMine, setLoadingMine]     = useState(true)
  const [loadingShared, setLoadingShared] = useState(true)
  const [folder, setFolder] = useState<string>('All')

  // Notes I own.
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(ownedNotesQuery(user.uid), snap => {
      setMyNotes(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Note))
      setLoadingMine(false)
    }, err => { console.error('Notes query failed:', err); setLoadingMine(false) })
    return unsub
  }, [user?.uid])

  // Notes others have shared with me — merged into the same home list, marked
  // with a "Shared" tag on the card (see NoteCard's isOwner prop).
  useEffect(() => {
    if (!user?.email) { setLoadingShared(false); return }
    const unsub = onSnapshot(sharedNotesQuery(user.email), snap => {
      setSharedNotes(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Note))
      setLoadingShared(false)
    }, err => { console.error('Shared notes query failed:', err); setLoadingShared(false) })
    return unsub
  }, [user?.email])

  const notes   = useMemo(() => sortByUpdated([...myNotes, ...sharedNotes]), [myNotes, sharedNotes])
  const loading = loadingMine || loadingShared

  const folders = useMemo(() => {
    const set = new Set<string>()
    notes.forEach(n => { if (n.folder.trim()) set.add(n.folder.trim()) })
    return ['All', ...Array.from(set).sort()]
  }, [notes])

  const shown = useMemo(() => {
    let list = folder === 'All' ? notes : notes.filter(n => n.folder.trim() === folder)
    if (query.trim()) list = list.filter(n => noteMatchesSearch(n, query))
    return list
  }, [notes, folder, query])

  return (
    <NotePage>
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 'calc(max(env(safe-area-inset-bottom), var(--aio-safe-bottom, 0px)) + 120px)' }}>
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
          <EmptyState onNew={() => router.push('/new')} filtered={folder !== 'All' || query.trim() !== ''} isSearch={query.trim() !== ''} />
        ) : (
          <>
            <SectionLbl label={query.trim() ? `${shown.length} result${shown.length > 1 ? 's' : ''}` : `${shown.length} note${shown.length > 1 ? 's' : ''}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 0' }}>
              {shown.map(n => (
                <NoteCard
                  key={n.id}
                  note={n}
                  onClick={() => router.push(`/note/${n.id}`)}
                  isOwner={!!user && n.ownerId === user.uid}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </NotePage>
  )
}

function EmptyState({ onNew, filtered, isSearch }: { onNew: () => void; filtered: boolean; isSearch: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 30px', color: N.textMut }}>
      <div style={{ fontFamily: N.bebas, fontSize: 28, color: N.textSec, letterSpacing: '0.04em' }}>
        {isSearch ? 'No matches' : filtered ? 'Nothing here' : 'No notes yet'}
      </div>
      <p style={{ fontSize: 13, margin: '8px 0 20px' }}>
        {isSearch ? 'Try a different title, word, or tag.' : filtered ? 'No notes in this folder.' : 'Start with a blank note or a template.'}
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
