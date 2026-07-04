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
- **Blank Note** — a **rich-text** page (`body` stores HTML). Editor is
  `app/components/RichEditor.tsx` (contentEditable + `document.execCommand`, no
  external libs). Supports: **Title/Heading/Subheading/Body** blocks (H1/H2/H3/P),
  **bold/italic/underline/strikethrough**, **auto-bullets** when a line starts with
  `- `, **Tab / Shift+Tab** to indent/outdent (sub-bullets), **hyperlinks**
  (Cmd/Ctrl-click a link to open it), and **collapsible headings** — click a
  heading's ▾ gutter chevron to hide everything under it until the next
  same-or-higher heading (state saved via `data-collapsed`). Styling for headings,
  chevrons, lists, links, and the placeholder lives in `globals.css` under
  `.rich-editor`. **Paste** is forced to plain text so it inherits the note's
  styling. The formatting controls live in a **floating, centered pill** with two
  full-width rows (space-between, so it reads the same on mobile and desktop). It is
  **pinned to the bottom of the visual viewport** — `pillRef.offsetHeight` +
  VisualViewport `offsetTop/height` + a `ResizeObserver` compute `pillTop` so it is
  *always* just above the on-screen keyboard, never behind it. Repositioning is
  rAF-throttled with **no CSS transition** so it tracks scrolling instantly (no lag).
  **Inside the AIO iframe** the VisualViewport API can't see the keyboard, so the AIO
  `/notes` page measures it and `postMessage`s `{type:'aio-kb', kb}` into the iframe;
  the editor listens for that and uses `parentKb` to stay above the keyboard. It can be **tucked
  away** to an "Aa" chip (persisted in `localStorage['notes_fmtbar_open']`) with a
  grow/shrink animation (`.pill-pop` in `globals.css`). Row 1 also has a **break-out**
  button (`detachBlock`) that toggles `data-detached` on the caret's block so a body
  paragraph can be excluded from its heading's collapse group (styled with an accent
  left border). Links open on a plain tap.
- **To-Do List** — checklist rows (`items[]` with `done`), tap to complete. Each row
  can carry an optional **due date** (stored in `item.date`); the row shows a colored
  Overdue / Due today / Due in Nd chip.
- **Grocery List** — checklist grouped by aisle/category (`items[]` with `category` from `GROCERY_CATEGORIES`).
- **Project Timeline** — milestone rows with a target `date` and done state.
- **Meal Plan** — weekly grid, 7 days × Breakfast/Lunch/Dinner (`items[]` keyed by `day` + `slot`).

Every structured note also has a freeform **Notes** field (`body`) at the bottom
(plain textarea; only Blank notes use the rich editor for `body`).

### Due dates
`item.date` (yyyy-mm-dd) is a **due date** on To-Do items and a **milestone date**
on Timeline items. `dueInfo(date, done)` in `lib/notes.ts` classifies it as
`overdue | today | soon (≤3d) | later` with a label; the note cards and the AIO
dashboard both use it. New notes suggest **existing folder names** via a `<datalist>`
on the folder input in the editor (`ownedNotesQuery` gathers the user's folders).

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

Queries (`lib/notes.ts`) — **single `where`, no `orderBy`**, then sorted
client-side via `sortByUpdated`. (A `where` + `orderBy('updatedAt')` combo needs a
manually-created Firestore composite index; without it the query fails and returns
nothing — which made the list look empty on every refresh. Sorting in JS avoids the
index entirely.)
- **Mine**: `where('ownerId','==',uid)`
- **Shared with me**: `where('sharedWith','array-contains', myEmail)`

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
- **Due dates on the dashboard** — the AIO home (`app/page.tsx`) subscribes to the
  signed-in user's notes (owned + shared) and scans To-Do + Timeline items for dates
  that are overdue or within 3 days (not done). It shows a count on the **Notes tile**
  (e.g. "2 due", red if any overdue) and a "N notes due" chip in **Today at a glance**.

## Design system — NotesShell
Tokens in the `N` object; accent is the CSS var `--na` (default Violet `#8a7ad8`).
`noteA(hexOpacity)` → `color-mix()` alpha. `ACCENT_THEMES` (Violet/Ocean/Sage/
Amber/Rose/Slate), `applyAccent(hex)` persists to `localStorage` (`notes_accent`)
and Settings also writes `users/{uid}/prefs/notesAccent` so the accent syncs inside
the AIO iframe (where third-party localStorage is blocked).

Shared components: `NotePage`, `Glass`, `PageHead`, `SectionLbl`, `StatPill`,
`AddBtn`, `PillBtn`, `BottomNav`. Card component: `app/components/NoteCard.tsx`.

### Scroll model — app shell, one inner scroll layer (iOS/iframe safe)
The document itself never scrolls. `globals.css` pins `body` to the exact
viewport (`position:fixed; inset:0; overflow:hidden`) — a **fixed body, not
`100dvh`**, to avoid the dynamic-viewport gap that left a black bar under the app.
`NotePage` fills it (`height:100%`) as a non-scrolling flex shell whose only
scrolling child is the inner **`.notes-scroll`** region (`flex:1;
overflow-y:auto; overscroll-behavior:contain`). This is required
because inside the **AIO iframe on iOS**, a document-scrolling page auto-expands
to content height and handles `position:fixed` relative to the whole content
(not the viewport) — which un-pinned the `BottomNav` pill and chained scroll
momentum into the parent, clipping AIO's "Return to AIO" header. With one bounded
inner scroll layer, the pill (`position:fixed`) and the editor's
`position:sticky` header stay pinned and scroll never leaves the iframe.
`BottomNav`'s hide-on-scroll listens on the active `.notes-scroll` element
(re-bound per route), not `window`. The page header (`PageHead`) and the AIO
"Return to AIO" bar both use `touch-action:none` so a swipe on the header can't
start a scroll/overscroll (which re-triggered the layering glitch); taps still work.

**Safe-area inset bridge.** A cross-origin iframe always reads
`env(safe-area-inset-bottom)` as `0`, so the AIO embed (`finance-dashboard
/app/notes/page.tsx`) measures the device inset and `postMessage`s
`{type:'aio-safe', safeBottom}` in. `BottomNavWrapper` stores it on the
`--aio-safe-bottom` CSS var, and the pill's bottom uses
`max(env(safe-area-inset-bottom), var(--aio-safe-bottom,0px)) + 16px` — correct
both standalone and embedded, with **no** reserved black strip in the iframe
container. (The editor's keyboard bridge already works the same way via
`aio-kb`; do **not** add container padding — it shifts the iframe coordinate
frame and mis-positions the editor's format pill.)

**No zoom.** All editables are ≥ 16px (globals force inputs to 16px; the
contentEditable `.rich-editor` is 16px) so iOS never focus-zooms a text field.
`body` has `touch-action:manipulation` (no double-tap zoom) and
`BottomNavWrapper` preventDefaults `gesturestart/change/end` to block pinch-zoom,
since iOS ignores the viewport `maximum-scale`/`user-scalable` hints.

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

### Added later
- **Rich-text Blank notes** (headings, B/I/U/S, auto-bullets, indent, links, collapsible headings).
- **Folder suggestions** (datalist of existing folders) in the note editor.
- **Due dates** on To-Do items; due dates + Timeline milestones surfaced on the AIO dashboard.
- **App-shell scroll model** (one inner `.notes-scroll` layer) — fixes iframe-only
  layering/scroll bugs on iOS: bottom-nav pill now stays pinned, and AIO's
  "Return to AIO" header no longer gets scrolled/clipped on the home screen.

### Not yet done / ideas
- Deploy to Vercel (needs GitHub repo + Vercel project; URL confirm).
- Optional tighter Firestore rules for `notes` (see above).
- Per-share view-only permission, live co-editing merge, note search, drag-reorder items.
