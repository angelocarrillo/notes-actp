import {
  collection, query, where, doc,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
  arrayUnion, arrayRemove, type Timestamp, type Query, type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NoteType = 'blank' | 'todo' | 'timeline' | 'grocery' | 'meal'

export interface NoteItem {
  id: string
  text: string
  done?: boolean       // todo, grocery, timeline
  category?: string    // grocery — section (Produce, Dairy…)
  date?: string        // timeline — milestone date (yyyy-mm-dd)
  day?: string         // meal plan — day of week
  slot?: string        // meal plan — Breakfast / Lunch / Dinner
}

export interface Note {
  id: string
  ownerId: string
  ownerEmail: string
  title: string
  type: NoteType
  folder: string
  body: string
  items: NoteItem[]
  sharedWith: string[]        // lowercased recipient emails
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}

// A note without server-managed fields — what create() accepts.
export type NewNote = Pick<Note, 'title' | 'type' | 'folder' | 'body' | 'items'>

// ─── Collection + queries ─────────────────────────────────────────────────────

export const notesCol = collection(db, 'notes')

// NOTE: these queries deliberately use only a single `where` and NO `orderBy`.
// Combining `where` + `orderBy('updatedAt')` would require a manually-created
// Firestore composite index; without it the query fails and returns nothing.
// We sort client-side instead (see sortByUpdated / the Home + Shared pages).

/** Notes I own (unsorted — sort client-side with sortByUpdated). */
export function ownedNotesQuery(uid: string): Query<DocumentData> {
  return query(notesCol, where('ownerId', '==', uid))
}

/** Notes shared with me by email (unsorted — sort client-side). */
export function sharedNotesQuery(email: string): Query<DocumentData> {
  return query(notesCol, where('sharedWith', 'array-contains', email.toLowerCase()))
}

/** Sort notes newest-first by updatedAt. A pending serverTimestamp (null,
 *  just-created) sorts to the top. */
export function sortByUpdated(notes: Note[]): Note[] {
  const ms = (t?: Timestamp | null) =>
    t && typeof (t as Timestamp).toMillis === 'function' ? (t as Timestamp).toMillis() : Number.POSITIVE_INFINITY
  return [...notes].sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createNote(uid: string, email: string, n: NewNote): Promise<string> {
  const ref = await addDoc(notesCol, {
    ownerId: uid,
    ownerEmail: email.toLowerCase(),
    title: n.title,
    type: n.type,
    folder: n.folder,
    body: n.body,
    items: n.items,
    sharedWith: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Patch a note. Always bumps updatedAt. */
export async function updateNote(id: string, patch: Partial<Note>): Promise<void> {
  await updateDoc(doc(db, 'notes', id), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteNote(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notes', id))
}

/** Share a note with someone by their Google email (view + edit). */
export async function shareNote(id: string, email: string): Promise<void> {
  await updateDoc(doc(db, 'notes', id), {
    sharedWith: arrayUnion(email.trim().toLowerCase()),
    updatedAt: serverTimestamp(),
  })
}

/** Revoke a share. */
export async function unshareNote(id: string, email: string): Promise<void> {
  await updateDoc(doc(db, 'notes', id), {
    sharedWith: arrayRemove(email.trim().toLowerCase()),
    updatedAt: serverTimestamp(),
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Short random id for note items (checklist rows, milestones…). */
export function itemId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim())
}

/** One-line summary for a note card (progress / count depending on type). */
export function noteSummary(n: Note): string {
  switch (n.type) {
    case 'todo':
    case 'grocery': {
      const total = n.items.length
      const done  = n.items.filter(i => i.done).length
      return total ? `${done}/${total} done` : 'Empty list'
    }
    case 'timeline': {
      const total = n.items.length
      const done  = n.items.filter(i => i.done).length
      return total ? `${done}/${total} milestones` : 'No milestones'
    }
    case 'meal':
      return n.items.length ? `${n.items.filter(i => i.text.trim()).length} meals planned` : 'Meal plan'
    default: {
      const text = n.body.trim()
      return text ? text.slice(0, 80) : 'Empty note'
    }
  }
}
