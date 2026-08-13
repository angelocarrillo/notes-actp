'use client'
import { useState } from 'react'
import { N, noteA } from './NotesShell'
import { type Note } from '@/lib/notes'
import { templateByType } from '@/lib/templates'

// Bottom sheet opened by long-pressing a NoteCard on Home. Owners get
// Share / Duplicate / Delete; recipients of a shared note only get Duplicate
// (they don't own the note, so they can't share or delete the original — but
// making their own copy is useful).
export function NoteActionsSheet({ note, isOwner, onClose, onShare, onDuplicate, onDelete }: {
  note: Note
  isOwner: boolean
  onClose: () => void
  onShare: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState<'duplicate' | 'delete' | null>(null)
  const tpl = templateByType(note.type)

  const duplicate = async () => {
    if (busy) return
    setBusy('duplicate')
    try { await onDuplicate() } finally { setBusy(null) }
  }

  const del = async () => {
    if (busy) return
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); return }
    setBusy('delete')
    try { await onDelete() } finally { setBusy(null) }
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `color-mix(in srgb, ${tpl.accent} 20%, transparent)`,
            border: `1px solid color-mix(in srgb, ${tpl.accent} 40%, transparent)`,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tpl.accent} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              {tpl.icon.split(' M').map((d, j) => <path key={j} d={j === 0 ? d : 'M' + d} />)}
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: N.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {note.title.trim() || 'Untitled'}
            </div>
            <div style={{ fontSize: 11, color: N.textMut }}>
              {isOwner ? tpl.name : `Shared by ${note.ownerEmail}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {isOwner && (
            <ActionRow
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 3.9M15.4 6.6l-6.8 3.9"/></svg>}
              label="Share"
              onClick={onShare}
            />
          )}
          <ActionRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
            label={busy === 'duplicate' ? 'Duplicating…' : 'Duplicate'}
            onClick={duplicate}
            disabled={busy !== null}
          />
          {isOwner && (
            <ActionRow
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>}
              label={busy === 'delete' ? 'Deleting…' : confirmDel ? 'Tap again to delete' : 'Delete'}
              onClick={del}
              disabled={busy !== null}
              destructive
            />
          )}
        </div>

        <button onClick={onClose} style={{ width: '100%', marginTop: 14, background: 'rgba(255,255,255,0.06)', border: `1px solid ${N.border}`, borderRadius: 12, padding: '12px', color: N.text, fontSize: 14, fontWeight: 600, fontFamily: N.font, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

function ActionRow({ icon, label, onClick, disabled, destructive }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; destructive?: boolean
}) {
  const color = destructive ? N.warn : N.text
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 14, width: '100%',
      background: 'none', border: 'none', borderTop: `1px solid ${N.border}`,
      padding: '14px 4px', color, fontFamily: N.font, fontSize: 15, fontWeight: 500,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, textAlign: 'left',
    }}>
      <span style={{ display: 'flex', color: destructive ? N.warn : noteA('ff'), flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  )
}
