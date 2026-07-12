'use client'
import { Glass, N, noteA } from './NotesShell'
import { type Note, noteSummary, dueInfo, type DueLevel } from '@/lib/notes'
import { templateByType } from '@/lib/templates'

const DUE_COLOR: Record<DueLevel, string> = { overdue: N.warn, today: '#f0b429', soon: '#f0b429', later: N.textMut }

/** Most urgent (soonest) not-done due item in a note, if within the "soon" window or overdue. */
function urgentDue(note: Note): { level: DueLevel; label: string } | null {
  let best: { level: DueLevel; days: number; label: string } | null = null
  for (const it of note.items) {
    const info = dueInfo(it.date, it.done)
    if (info && info.level !== 'later' && (!best || info.days < best.days)) best = info
  }
  return best
}

function relTime(ts?: { toDate?: () => Date } | null): string {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60)     return 'just now'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function TypeIcon({ path, color }: { path: string; color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {path.split(' M').map((d, j) => <path key={j} d={j === 0 ? d : 'M' + d} />)}
    </svg>
  )
}

export function NoteCard({ note, onClick, subtitle, isOwner = true }: {
  note: Note; onClick: () => void; subtitle?: string; isOwner?: boolean
}) {
  const tpl    = templateByType(note.type)
  const shared = note.sharedWith?.length ?? 0

  return (
    <Glass onClick={onClick} accent={tpl.accent} p={16} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `color-mix(in srgb, ${tpl.accent} 20%, transparent)`,
          border: `1px solid color-mix(in srgb, ${tpl.accent} 40%, transparent)`,
        }}>
          <TypeIcon path={tpl.icon} color={tpl.accent} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 16, fontWeight: 600, color: N.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {note.title.trim() || 'Untitled'}
          </div>
          <div style={{
            fontSize: 12, color: N.textMut,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {subtitle ?? noteSummary(note)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
          color: tpl.accent, background: `color-mix(in srgb, ${tpl.accent} 14%, transparent)`,
          borderRadius: 20, padding: '3px 8px',
        }}>
          {tpl.name}
        </span>
        {note.folder.trim() && (
          <span style={{
            fontSize: 10, color: N.textSec, background: N.surface,
            borderRadius: 20, padding: '3px 9px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120,
          }}>
            {note.folder.trim()}
          </span>
        )}
        {(() => {
          const due = urgentDue(note)
          if (!due) return null
          return (
            <span style={{
              fontSize: 10, fontWeight: 700, color: DUE_COLOR[due.level],
              background: `color-mix(in srgb, ${DUE_COLOR[due.level]} 16%, transparent)`,
              borderRadius: 20, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              {due.label}
            </span>
          )
        })()}
        {isOwner && shared > 0 && (
          <span style={{ fontSize: 10, color: noteA('cc'), display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 3.9M15.4 6.6l-6.8 3.9"/>
            </svg>
            {shared}
          </span>
        )}
        {!isOwner && (
          <span style={{ fontSize: 10, color: noteA('cc'), display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 3.9M15.4 6.6l-6.8 3.9"/>
            </svg>
            Shared
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: N.textDim, fontFamily: N.mono }}>
          {relTime(note.updatedAt as { toDate?: () => Date } | null)}
        </span>
      </div>
    </Glass>
  )
}
