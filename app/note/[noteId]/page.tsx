'use client'
import { useEffect, useMemo, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useUser } from '../../components/AuthGate'
import { NotePage, N, noteA, PillBtn } from '../../components/NotesShell'
import { useModalLock } from '@/lib/useModalLock'
import { RichEditor } from '../../components/RichEditor'
import {
  updateNote, deleteNote, shareNote, unshareNote, ownedNotesQuery,
  itemId, isValidEmail, dueInfo, type Note, type NoteItem, type DueLevel,
} from '@/lib/notes'
import { templateByType, GROCERY_CATEGORIES, WEEKDAYS, MEAL_SLOTS } from '@/lib/templates'

// Freeform, low-chrome field style used across the structured note editors —
// an underline instead of a boxed card, so a list of fields reads as plain
// rows on the page rather than a stack of boxes.
const inputSx: React.CSSProperties = {
  width: '100%', background: 'transparent',
  border: 'none', borderBottom: `1px solid ${N.border}`, borderRadius: 0,
  padding: '8px 2px', color: N.text, fontFamily: N.font,
  outline: 'none', boxSizing: 'border-box',
}

type SaveState = 'idle' | 'saving' | 'saved'

export default function NoteEditorPage({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = use(params)
  const user   = useUser()
  const router = useRouter()

  const [note, setNote]         = useState<Note | null>(null)
  const [missing, setMissing]   = useState(false)
  const [save, setSave]         = useState<SaveState>('idle')
  const [shareOpen, setShareOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [folders, setFolders]   = useState<string[]>([])

  const hydrated  = useRef(false)
  const lastEdit  = useRef(0)
  const noteRef   = useRef<Note | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useModalLock(shareOpen)

  // ── Subscribe ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'notes', noteId), snap => {
      if (!snap.exists()) { setMissing(true); return }
      const data = { id: snap.id, ...snap.data() } as Note
      if (!hydrated.current) {
        hydrated.current = true
        noteRef.current  = data
        setNote(data)
      } else if (Date.now() - lastEdit.current > 4000) {
        // Idle → pull in remote edits (e.g. from someone the note is shared with)
        noteRef.current = data
        setNote(data)
      }
    }, () => setMissing(true))
    return unsub
  }, [noteId])

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // Existing folder names → suggestions for the folder input
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(ownedNotesQuery(user.uid), snap => {
      const set = new Set<string>()
      snap.docs.forEach(d => { const f = ((d.data().folder as string) || '').trim(); if (f) set.add(f) })
      setFolders(Array.from(set).sort())
    }, () => { /* ignore */ })
    return unsub
  }, [user?.uid])

  // ── Local edit + debounced save ───────────────────────────────────────────────
  function patchNote(patch: Partial<Note>) {
    if (!noteRef.current) return
    const merged = { ...noteRef.current, ...patch }
    noteRef.current = merged
    setNote(merged)
    lastEdit.current = Date.now()
    setSave('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const n = noteRef.current
      if (!n) return
      try {
        await updateNote(noteId, { title: n.title, folder: n.folder, body: n.body, items: n.items })
        setSave('saved')
      } catch (e) {
        console.error('Save failed', e)
        setSave('idle')
      }
    }, 650)
  }

  const setItems = (items: NoteItem[]) => patchNote({ items })
  const updateItem = (id: string, patch: Partial<NoteItem>) =>
    setItems((note?.items ?? []).map(i => i.id === id ? { ...i, ...patch } : i))
  const removeItem = (id: string) =>
    setItems((note?.items ?? []).filter(i => i.id !== id))
  const addItem = (partial: Partial<NoteItem>) =>
    setItems([...(note?.items ?? []), { id: itemId(), text: '', ...partial }])

  // ── Missing / loading ─────────────────────────────────────────────────────────
  if (missing) {
    return (
      <NotePage>
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 }}>
          <div style={{ fontFamily: N.bebas, fontSize: 30, color: N.textSec }}>Note unavailable</div>
          <p style={{ color: N.textMut, fontSize: 13, textAlign: 'center' }}>It may have been deleted or a share was removed.</p>
          <PillBtn onClick={() => router.push('/')}>Back to notes</PillBtn>
        </div>
      </NotePage>
    )
  }
  if (!note) {
    return <NotePage><p style={{ textAlign: 'center', color: N.textMut, fontSize: 13, marginTop: 80 }}>Loading…</p></NotePage>
  }

  const tpl     = templateByType(note.type)
  const isOwner = !!user && note.ownerId === user.uid

  return (
    <NotePage>
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: 'calc(env(safe-area-inset-top) + 10px) 14px 10px',
        background: 'linear-gradient(180deg, rgba(10,10,12,0.92), rgba(10,10,12,0.72) 70%, transparent)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <button onClick={() => router.push('/')} aria-label="Back" style={{ background: 'none', border: 'none', color: N.textSec, cursor: 'pointer', padding: 4, display: 'flex' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <span style={{ flex: 1, fontSize: 11, color: N.textDim, fontFamily: N.mono, letterSpacing: '0.08em' }}>
          {save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : ''}
        </span>

        {!isOwner && (
          <span style={{ fontSize: 10, color: noteA('cc'), border: `1px solid ${noteA('55')}`, borderRadius: 20, padding: '4px 10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Shared with you
          </span>
        )}

        {isOwner && (
          <>
            <button onClick={() => setShareOpen(true)} aria-label="Share" style={iconBtnSx}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 3.9M15.4 6.6l-6.8 3.9"/></svg>
            </button>
            <button
              onClick={() => { if (confirmDel) { deleteNote(noteId).then(() => router.push('/')) } else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000) } }}
              aria-label="Delete"
              style={{ ...iconBtnSx, color: confirmDel ? '#fff' : N.warn, background: confirmDel ? N.warn : 'transparent', borderColor: N.warn }}
            >
              {confirmDel ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '0 4px', whiteSpace: 'nowrap' }}>Delete?</span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              )}
            </button>
          </>
        )}
      </div>

      <div style={{ padding: '4px 18px calc(env(safe-area-inset-bottom) + 60px)', maxWidth: 640, margin: '0 auto' }}>
        {/* Title */}
        <input
          className="input-lg"
          value={note.title}
          onChange={e => patchNote({ title: e.target.value })}
          placeholder="Untitled"
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            color: N.text, fontFamily: N.bebas, letterSpacing: '0.02em',
            padding: '8px 0 4px',
          }}
        />

        {/* Folder + type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 140 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={N.textMut} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <input
              value={note.folder}
              onChange={e => patchNote({ folder: e.target.value })}
              placeholder="No folder"
              list="folder-suggestions"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: N.textSec, fontSize: 13, fontFamily: N.font, width: '100%' }}
            />
            <datalist id="folder-suggestions">
              {folders.map(f => <option key={f} value={f} />)}
            </datalist>
          </div>
          <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: tpl.accent, background: `color-mix(in srgb, ${tpl.accent} 14%, transparent)`, borderRadius: 20, padding: '4px 10px' }}>
            {tpl.name}
          </span>
        </div>

        {/* Type-specific editor */}
        {note.type === 'blank'    && <RichEditor value={note.body} onChange={b => patchNote({ body: b })} />}
        {note.type === 'todo'     && <ChecklistEditor note={note} onUpdate={updateItem} onRemove={removeItem} onSetItems={setItems} />}
        {note.type === 'grocery'  && <GroceryEditor note={note} onUpdate={updateItem} onRemove={removeItem} onAdd={cat => addItem({ done: false, category: cat })} />}
        {note.type === 'timeline' && <TimelineEditor note={note} onUpdate={updateItem} onRemove={removeItem} onAdd={() => addItem({ done: false, date: '' })} />}
        {note.type === 'meal'     && <MealEditor note={note} onUpdate={updateItem} onAdd={(day, slot) => addItem({ day, slot })} />}

        {/* Freeform notes on structured templates */}
        {note.type !== 'blank' && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: N.textMut, marginBottom: 8 }}>Notes</div>
            <AutoTextarea value={note.body} onChange={b => patchNote({ body: b })} placeholder="Add any extra notes…" minHeight={70} />
          </div>
        )}
      </div>

      {shareOpen && isOwner && (
        <ShareSheet note={note} onClose={() => setShareOpen(false)} />
      )}
    </NotePage>
  )
}

const iconBtnSx: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${N.border}`, borderRadius: 10,
  color: N.textSec, cursor: 'pointer', height: 34, minWidth: 34,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
}

// ─── Auto-growing textarea ────────────────────────────────────────────────────
function AutoTextarea({ value, onChange, placeholder, minHeight = 200 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minHeight?: number
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(minHeight, el.scrollHeight) + 'px'
  }
  useEffect(() => { grow(ref.current) }, [value])
  return (
    <textarea
      ref={el => { ref.current = el; grow(el) }}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '4px 0', color: N.text, fontFamily: N.font,
        lineHeight: 1.55, resize: 'none', outline: 'none', boxSizing: 'border-box',
        minHeight,
      }}
    />
  )
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Check({ on, onClick, color }: { on: boolean; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} aria-label="toggle" style={{
      width: 22, height: 22, flexShrink: 0, cursor: 'pointer', borderRadius: 7,
      border: `2px solid ${on ? color : N.borderHi}`, background: on ? color : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    }}>
      {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0a0a0c" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
    </button>
  )
}

function RowDelete({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Remove" style={{ background: 'none', border: 'none', color: N.textDim, cursor: 'pointer', padding: 4, flexShrink: 0, display: 'flex' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  )
}

function AddRowBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
      background: 'transparent', border: 'none',
      color: N.textMut, fontSize: 13, fontFamily: N.font, padding: '10px 2px', width: '100%',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
      {label}
    </button>
  )
}

// ─── Due-date chip (To-Do rows) ────────────────────────────────────────────────
// Compact, single-line: a muted calendar icon when there's no date (the
// "subtle way to add a due date"), or a small colored label once one is set.
// No boxed input — the native date picker is an invisible overlay on the label.
const DUE_COLOR: Record<DueLevel, string> = {
  overdue: N.warn, today: '#f0b429', soon: '#f0b429', later: N.textSec,
}
function DueChip({ value, done, onChange }: { value?: string; done?: boolean; onChange: (d: string) => void }) {
  const info = dueInfo(value, done)
  const coverInput: React.CSSProperties = { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }
  if (!value) {
    return (
      <label style={{ position: 'relative', display: 'flex', alignItems: 'center', color: N.textDim, cursor: 'pointer', flexShrink: 0, padding: 4 }} title="Add due date">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        <input type="date" value="" onChange={e => onChange(e.target.value)} style={coverInput} />
      </label>
    )
  }
  const color = info ? DUE_COLOR[info.level] : N.textMut
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
      <label style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, color, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {info ? info.label : 'Done'}
        <input type="date" value={value} onChange={e => onChange(e.target.value)} style={coverInput} />
      </label>
      <button onClick={() => onChange('')} aria-label="Clear due date" style={{ background: 'none', border: 'none', color: N.textDim, cursor: 'pointer', fontSize: 11, padding: 2, lineHeight: 1 }}>✕</button>
    </div>
  )
}

// ─── To-Do checklist ──────────────────────────────────────────────────────────
// A flat, borderless list. Enter on a row creates a new item right after it and
// focuses it; Backspace on an empty row deletes it and moves focus up — the
// same feel as iOS Notes / Reminders checklists. Items default to no due date;
// once several items share the same date they automatically cluster together
// under one small date heading instead of each repeating it.
function ChecklistEditor({ note, onUpdate, onRemove, onSetItems }: {
  note: Note
  onUpdate: (id: string, p: Partial<NoteItem>) => void
  onRemove: (id: string) => void
  onSetItems: (items: NoteItem[]) => void
}) {
  const accent = templateByType('todo').accent
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const focusNext = useRef<string | null>(null)

  useEffect(() => {
    if (focusNext.current) {
      inputRefs.current[focusNext.current]?.focus()
      focusNext.current = null
    }
  })

  const insertAfter = (afterId: string | null) => {
    const items = note.items.slice()
    const id = itemId()
    const at = afterId ? items.findIndex(i => i.id === afterId) + 1 : items.length
    items.splice(at, 0, { id, text: '', done: false })
    focusNext.current = id
    onSetItems(items)
  }

  const removeAndFocusPrev = (id: string) => {
    const items = note.items
    const idx = items.findIndex(i => i.id === id)
    if (items.length <= 1) return   // keep at least one row
    const prev = items[idx - 1]
    if (prev) focusNext.current = prev.id
    onSetItems(items.filter(i => i.id !== id))
  }

  const undated = note.items.filter(i => !i.date)
  const groups  = useMemo(() => {
    const map = new Map<string, NoteItem[]>()
    note.items.forEach(i => { if (i.date) map.set(i.date, [...(map.get(i.date) ?? []), i]) })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [note.items])

  const row = (it: NoteItem) => (
    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0' }}>
      <Check on={!!it.done} color={accent} onClick={() => onUpdate(it.id, { done: !it.done })} />
      <input
        ref={el => { inputRefs.current[it.id] = el }}
        value={it.text}
        onChange={e => onUpdate(it.id, { text: e.target.value })}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); insertAfter(it.id) }
          else if (e.key === 'Backspace' && it.text === '') { e.preventDefault(); removeAndFocusPrev(it.id) }
        }}
        placeholder="List item"
        style={{
          flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
          padding: '6px 0', fontFamily: N.font, fontSize: 16,
          textDecoration: it.done ? 'line-through' : 'none', color: it.done ? N.textMut : N.text,
        }}
      />
      <DueChip value={it.date} done={it.done} onChange={d => onUpdate(it.id, { date: d })} />
      <RowDelete onClick={() => onRemove(it.id)} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {undated.map(row)}
      </div>
      {groups.map(([date, items]) => {
        const info  = dueInfo(date, false)
        const color = info ? DUE_COLOR[info.level] : N.textMut
        return (
          <div key={date} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color, marginBottom: 2 }}>
              {info ? info.label : date}
            </div>
            {items.map(row)}
          </div>
        )
      })}
      <AddRowBtn label="Add item" onClick={() => insertAfter(note.items.length ? note.items[note.items.length - 1].id : null)} />
    </div>
  )
}

// ─── Grocery (grouped by aisle) ───────────────────────────────────────────────
function GroceryEditor({ note, onUpdate, onRemove, onAdd }: {
  note: Note; onUpdate: (id: string, p: Partial<NoteItem>) => void; onRemove: (id: string) => void; onAdd: (cat: string) => void
}) {
  const accent = templateByType('grocery').accent
  const cats = GROCERY_CATEGORIES.filter(c => note.items.some(i => (i.category ?? 'Other') === c))
  const uncategorized = note.items.filter(i => !GROCERY_CATEGORIES.includes(i.category ?? 'Other'))
  const groups = [...cats, ...(uncategorized.length ? ['Other'] : [])]
  const shown = groups.length ? groups : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {shown.map(cat => (
        <div key={cat}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, marginBottom: 8, fontWeight: 700 }}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {note.items.filter(i => (GROCERY_CATEGORIES.includes(i.category ?? 'Other') ? i.category : 'Other') === cat).map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Check on={!!it.done} color={accent} onClick={() => onUpdate(it.id, { done: !it.done })} />
                <input
                  value={it.text}
                  onChange={e => onUpdate(it.id, { text: e.target.value })}
                  placeholder="Item"
                  style={{ ...inputSx, textDecoration: it.done ? 'line-through' : 'none', color: it.done ? N.textMut : N.text }}
                />
                <select
                  value={it.category ?? 'Other'}
                  onChange={e => onUpdate(it.id, { category: e.target.value })}
                  style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${N.border}`, borderRadius: 0, color: N.textSec, padding: '8px 4px', fontFamily: N.font, maxWidth: 96 }}
                >
                  {GROCERY_CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#16161a' }}>{c}</option>)}
                </select>
                <RowDelete onClick={() => onRemove(it.id)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <AddRowBtn label="Add grocery item" onClick={() => onAdd(GROCERY_CATEGORIES[0])} />
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function TimelineEditor({ note, onUpdate, onRemove, onAdd }: {
  note: Note; onUpdate: (id: string, p: Partial<NoteItem>) => void; onRemove: (id: string) => void; onAdd: () => void
}) {
  const accent = templateByType('timeline').accent
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {note.items.map(it => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Check on={!!it.done} color={accent} onClick={() => onUpdate(it.id, { done: !it.done })} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              value={it.text}
              onChange={e => onUpdate(it.id, { text: e.target.value })}
              placeholder="Milestone"
              style={{ ...inputSx, fontWeight: 600, textDecoration: it.done ? 'line-through' : 'none', color: it.done ? N.textMut : N.text }}
            />
            <input
              type="date"
              value={it.date ?? ''}
              onChange={e => onUpdate(it.id, { date: e.target.value })}
              style={{ ...inputSx, color: it.date ? N.textSec : N.textMut, padding: '8px 12px' }}
            />
          </div>
          <RowDelete onClick={() => onRemove(it.id)} />
        </div>
      ))}
      <AddRowBtn label="Add milestone" onClick={onAdd} />
    </div>
  )
}

// ─── Meal plan (weekly grid) ──────────────────────────────────────────────────
function MealEditor({ note, onUpdate, onAdd }: {
  note: Note; onUpdate: (id: string, p: Partial<NoteItem>) => void; onAdd: (day: string, slot: string) => void
}) {
  const accent = templateByType('meal').accent
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {WEEKDAYS.map(day => (
        <div key={day}>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, marginBottom: 8, fontWeight: 700 }}>{day}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MEAL_SLOTS.map(slot => {
              const it = note.items.find(i => i.day === day && i.slot === slot)
              return (
                <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 74, flexShrink: 0, fontSize: 11, color: N.textMut }}>{slot}</span>
                  <input
                    value={it?.text ?? ''}
                    onChange={e => it ? onUpdate(it.id, { text: e.target.value }) : onAdd(day, slot)}
                    placeholder="—"
                    style={{ ...inputSx, padding: '8px 12px' }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Share sheet ──────────────────────────────────────────────────────────────
function ShareSheet({ note, onClose }: { note: Note; onClose: () => void }) {
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
          Add someone by their Google email. They&apos;ll see it under <b style={{ color: N.textSec }}>Shared</b> and can view and edit it.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: err ? 6 : 14 }}>
          <input
            value={email}
            onChange={e => { setEmail(e.target.value); setErr('') }}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder="name@gmail.com"
            inputMode="email"
            style={{ ...inputSx, flex: 1 }}
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
