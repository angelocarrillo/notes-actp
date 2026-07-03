# Notes — Project Context

## Cowork project convention — every app is built the same way

Part of the **Joint AIO** Cowork project. Same architecture as `finance-dashboard`
(the AIO app) and `fitness-app`, so all apps stay visually + structurally
consistent and share one Firebase project.

- **Stack** — Next.js 16 (App Router) + TypeScript 5, deployed on Vercel via `git push`.
- **Styling** — inline React style objects only. No Tailwind, no CSS modules, no UI libs.
- **Design system** — one shell component (`NotesShell`) holding design tokens + shared components (`Glass`, `PageHead`, `BottomNav`, etc.), mirroring `FitShell` / `AIOShell`.
- **Liquid Glass material (iOS 26)** — glass surfaces use the shared `.liquid-glass` class in `globals.css`.
- **Fonts** — Bebas Neue (headings), DM Sans (body), DM Mono (numbers) via Google Fonts.
- **Navigation** — fixed pill nav with an animated morphing "blob" indicator (Notes · Shared · Settings), mounted persistently via `BottomNavWrapper`.
- **Backend** — shared Firebase project (Firestore + Auth); Google Sign-in. Data is real-time via `onSnapshot`.
- **Quality gate** — `npx tsc --noEmit` must pass before every commit.

## What the app does

A mobile-first notes app for the household. Sign in with any Google account; jot
down notes, organize them into folders, and start notes from templates. **Individual
notes can be shared with other people by their Google email — shared recipients can
view AND edit.** It replaces the **Projects** card in the AIO dashboard.

### Note types (templates)
- **Blank Note** — a plain auto-growing text page (`body`).
- **To-Do List** — checklist rows (`items[]` with `done`), tap to complete.
- **Grocery List** — checklist grouped by aisle/category (`items[]` with `category` from `GROCERY_CATEGORIES`).
- **Project Timeline** — milestone rows with a target `date` and done state.
- **Meal Plan** — weekly grid, 7 days × Breakfast/Lunch/Dinner (`items[]` keyed by `day` + `slot`).

Every structured note also has a freeform **Notes** field (`body`) at the bottom.

## Pages / routes
```
/                  Home — my notes, folder filter pills, + New
/new               Template picker → creates a note, redirects to /note/[id]
/note/[noteId]     Full-screen editor (all 5 types), autosave, Share, Delete
/shared            Notes other people shared with my Google account
/settings          Account, accent color picker, sign out
```
The bottom nav (Notes · Shared · Settings) is hidden on `/note/[...]` so the editor
gets the full screen.

## Data model — top-level `notes` collection

Unlike `fitness-app` (which isolates everything under `users/{uid}/`), notes live
in a **top-level `notes` collection** so they can be shared across users.

```
notes/{noteId}
  ownerId: string           ← creator's uid
  ownerEmail: string        ← creator's email (lowercased)
  title: string
  type: 'blank'|'todo'|'grocery'|'timeline'|'meal'
  folder: string            ← free-text folder/label ('' = none)
  body: string              ← freeform text
  items: NoteItem[]         ← structured content (see below)
  sharedWith: string[]      ← lowercased recipient emails (view + edit)
  createdAt, updatedAt      ← serverTimestamp()

NoteItem = {
  id: string                ← itemId()
  text: string
  done?: boolean            ← todo, grocery, timeline
  category?: string         ← grocery (Produce, Dairy…)
  date?: string             ← timeline milestone (yyyy-mm-dd)
  day?: string; slot?: string   ← meal plan (Monday…, Breakfast/Lunch/Dinner)
}
```

Queries (`lib/notes.ts`):
- **Mine**: `where('ownerId','==',uid) orderBy('updatedAt','desc')`
- **Shared with me**: `where('sharedWith','array-contains', myEmail) orderBy('updatedAt','desc')`

### Sharing
`shareNote(id, email)` adds a lowercased email to `sharedWith` (`arrayUnion`);
`unshareNote` removes it (`arrayRemove`). Recipients find the note under **Shared**
(matched by their Google email) and can edit it. Only the **owner** sees the Share
and Delete controls; recipients see a "Shared with you" tag.

### Editor autosave + concurrent edits
The editor keeps a local working copy and **debounces saves (650ms)** via
`updateNote`. It subscribes to the note doc; while you're actively typing it keeps
your local copy, and when **idle > 4s** it pulls in remote edits (so a co-editor's
changes eventually appear). This is intentionally simple: **last save wins** — there
is no live character-level merge. Fine for a household; revisit if true real-time
co-editing is needed.

## Auth
`app/components/AuthGate.tsx` — Google Sign-in only, persistent Firebase session.
Also accepts a `?token=` custom token so the app signs in silently when embedded in
the AIO iframe. Exposes `UserContext` / `useUser()`.

## Firebase setup
Same `NEXT_PUBLIC_FIREBASE_*` env vars as the AIO app — copy from
`finance-dashboard/.env.local` into `Notes App/.env.local` (already done during
build; `.env.local.example` documents the keys).

**Firestore security rules.** The project's currently-deployed rules already allow
any signed-in user to read/write, so sharing works today. Recommended tighter rules
for the `notes` collection (add to the shared `finance-dashboard/firestore.rules`
when you harden the project):
```
match /notes/{noteId} {
  allow read, update, delete: if request.auth != null && (
    request.auth.uid == resource.data.ownerId ||
    request.auth.token.email in resource.data.sharedWith
  );
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.ownerId;
}
```
> The `sharedWith` query and rule match on **email**, so recipients must have
> `NEXT_PUBLIC` Google emails saved lowercase (the app lowercases automatically).

## AIO dashboard integration (replaces the Projects card)
In `finance-dashboard`:
- **Module tile** — the "Projects" tile in `app/page.tsx` is now **Notes**
  (`href: '/notes'`, `IconNotes`).
- **Embed route** — `app/notes/page.tsx` iframes the deployed Notes app, mirroring
  `app/fitness/page.tsx`. It mints a Firebase custom token via the existing generic
  `app/api/fitness-token/route.ts` and passes it as `?token=` so the user is signed
  in silently.
- **URL** — the iframe points at `https://notes-actp.vercel.app/` (`NOTES_URL` const
  in `app/notes/page.tsx`). **If you name the Vercel project differently, update
  that constant AND the `frame-ancestors` host stays `aio-actp.vercel.app` in
  `Notes App/next.config.ts`.**
- The old `app/projects/page.tsx` is left in place (unlinked) so no data is lost.

## Design system — NotesShell
Tokens in the `N` object; accent is the CSS var `--na` (default Violet `#8a7ad8`).
`noteA(hexOpacity)` → `color-mix()` alpha. `ACCENT_THEMES` (Violet/Ocean/Sage/
Amber/Rose/Slate), `applyAccent(hex)` persists to `localStorage` (`notes_accent`)
and Settings also writes `users/{uid}/prefs/notesAccent` so the accent syncs inside
the AIO iframe (where third-party localStorage is blocked).

Shared components: `NotePage`, `Glass`, `PageHead`, `SectionLbl`, `StatPill`,
`AddBtn`, `PillBtn`, `BottomNav`. Card component: `app/components/NoteCard.tsx`.

## Key files
```
app/
  layout.tsx                    # AuthGate + persistent BottomNavWrapper
  page.tsx                      # Home (my notes + folder filter)
  new/page.tsx                  # Template picker
  note/[noteId]/page.tsx        # Editor (all types) + Share sheet + delete
  shared/page.tsx               # Notes shared with me
  settings/page.tsx             # Account, accent, sign out
  components/
    NotesShell.tsx              # Design system (tokens + components + BottomNav)
    NoteCard.tsx                # Note list card
    AuthGate.tsx                # Google sign-in (+ ?token= silent sign-in)
    BottomNavWrapper.tsx        # Mounts nav; hides on /note/*; syncs accent
  globals.css                   # Fonts + Liquid Glass + no-zoom rules
lib/
  firebase.ts                   # Firebase init (shared config)
  notes.ts                      # Note types, queries, CRUD, sharing helpers
  templates.ts                  # Template defs + seedNote()
  useModalLock.ts               # Ref-counted body[data-modal] (hides nav)
```

## Deploy
```
git add -A && git commit -m "..." && git push
```
(Vercel auto-deploys on push once the GitHub repo + Vercel project are set up — see
the setup steps in the chat / README.)

## Current status
### Built
- Full app: Home, template picker, editor for all 5 note types, Shared, Settings.
- Folder organization (free-text folder + Home filter pills).
- Share individual notes by Google email (view + edit); Shared tab for recipients.
- Debounced autosave with idle remote-sync.
- Accent theming; Liquid Glass design system ported from FitShell.
- AIO integration: Projects tile → Notes, `/notes` iframe route + token.

### Not yet done / ideas
- Deploy to Vercel (needs GitHub repo + Vercel project; URL confirm).
- Optional tighter Firestore rules for `notes` (see above).
- Per-share view-only permission, live co-editing merge, note search, drag-reorder items.
