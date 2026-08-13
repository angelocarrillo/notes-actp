'use client'
import { useState } from 'react'
import { N, noteA } from './NotesShell'
import { shareNote, unshareNote, isValidEmail, type Note } from '@/lib/notes'

// Bottom sheet for adding/removing people a note is shared with. Used both by
// the note editor's Share button and by Home's long-press note-actions sheet.
const fieldSx: React.CSSProperties = {
  width: '100%', background: 'transparent',
  border: 'none', borderBottom: `1px solid ${N.border}`, borderRadius: 0,
  padding: '8px 2px', color: N.text, fontFamily: N.font,
  outline: 'none', boxSizing: 'border-box',
}

export function ShareSheet({ note, onClose }: { note: Note; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [err, setErr]     = useState('')
  const [busy, setBusy]   = useState(false)

  const add = async () => {
    const e = email.trim().toLowerCase()
    if (!isValidEmail(e)) { setErr('Enter a valid email'); return }
    if (note.sharedWith?.includes(e)) { setErr('Already shared with them'); return }
    setBusy(true); setErr('')
    try { await shareNote(note.id, e); setEmail('') }
    catch { setErr('Could not share — try again') }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 460, background: '#131318',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        border: `1px solid ${N.border}`, borderBottom: 'none',
        padding: '20px 20px calc(env(safe-area-inset-bottom) + 24px)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: N.borderHi, margin: '0 auto 16px' }} />
        <div style={{ fontFamily: N.bebas, fontSize: 24, letterSpacing: '0.03em', marginBottom: 4 }}>Share note</div>
        <p style={{ color: N.textMut, fontSize: 12.5, margin: '0 0 16px' }}>
          Add someone by their Google email. They&apos;ll see it on <b style={{ color: N.textSec }}>Home</b>, tagged as Shared, and can view and edit it.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: err ? 6 : 14 }}>
          <input
            value={email}
            onChange={e => { setEmail(e.target.value); setErr('') }}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder="name@gmail.com"
            inputMode="email"
            style={{ ...fieldSx, flex: 1 }}
          />
          <button onClick={add} disabled={busy} className="lg-press" style={{
            background: N.note, color: '#0a0a0c', border: 'none', borderRadius: 10,
            padding: '0 18px', fontSize: 14, fontWeight: 700, fontFamily: N.font,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          }}>Add</button>
        </div>
        {err && <p style={{ color: N.warn, fontSize: 12, margin: '0 0 14px' }}>{err}</p>}

        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: N.textMut, margin: '4px 0 8px' }}>
          Shared with {note.sharedWith?.length ? `(${note.sharedWith.length})` : ''}
        </div>
        {(!note.sharedWith || note.sharedWith.length === 0) ? (
          <p style={{ color: N.textDim, fontSize: 13, margin: '0 0 8px' }}>Not shared with anyone yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {note.sharedWith.map(e => (
              <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${N.border}`, borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: noteA('33'), color: N.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{e[0]}</div>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: N.textSec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e}</span>
                <button onClick={() => unshareNote(note.id, e)} style={{ background: 'none', border: 'none', color: N.textMut, cursor: 'pointer', fontSize: 12, fontFamily: N.font }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', marginTop: 18, background: 'rgba(255,255,255,0.06)', border: `1px solid ${N.border}`, borderRadius: 12, padding: '12px', color: N.text, fontSize: 14, fontWeight: 600, fontFamily: N.font, cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  )
}
