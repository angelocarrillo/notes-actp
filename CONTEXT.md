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
- **Navigation** — fixed bottom pill holding a **search box + Settings button** (see *Search* below), mounted persistently via `BottomNavWrapper`. There is no more Notes/Shared/Settings tab bar — Home is the only list view, reached via its back arrow, and Settings is the pill's trailing icon button.
- **Backend** — shared Firebase project (Firestore + Auth); Google Sign-in. Data is real-time via `onSnapshot`.
- **Quality gate** — `npx tsc --noEmit` must pass before every commit.

## What the app does

A mobile-first notes app for the household. Sign in with any Google account; jot
down notes, organize them into folders, and start notes from templates. **Individual
notes can be shared with other people by their Google email — shared recipients can
view AND edit.** It replaces the **Projects** card in the AIO dashboard.

The whole editing surface is deliberately **low-chrome / freeform** — closer to a
blank whiteboard than a form. Structured fields use an underline instead of a
boxed card (`inputSx` in the editor page), "Add row" controls are plain text
rows (no dashed box), and the Blank Note page has no card around it at all. See
*Freeform styling* below for the full list of what changed and why.

### Note types (templates)
- **Blank Note** — a **rich-text** page (`body` stores HTML), rendered as a
  **borderless, cardless page** (no background box, no border — just text on
  the note page background, iOS-Notes style). Editor is
  `app/components/RichEditor.tsx` (contentEditable + `document.execCommand`, no
  external libs). Supports: **Title/Heading/Subheading/Body** blocks (H1/H2/H3/P),
  **bold/italic/underline/strikethrough**, **auto-bullets** when a line starts with
  `- `, **Tab / Shift+Tab** to indent/outdent (sub-bullets), **hyperlinks**
  (Cmd/Ctrl-click a link to open it), and **collapsible headings** — click a
  heading's ▾ gutter chevron to hide everything under it until the next
  same-or-higher heading (state saved via `data-collapsed`). Styling for headings,
  chevrons, lists, links, and the placeholder lives in `globals.css` under
  `.rich-editor`. Heading sizes were toned down (h1 30→24px, h2 21→18px) for a
  quieter hierarchy; **body text stays at the 16px floor** (see *Freeform
  styling*) — it isn't sized down further because Safari auto-zooms a focused
  editable below 16px. **Paste** is forced to plain text so it inherits the note's
  styling. The formatting controls live in a **floating, centered pill** with two
  full-width rows (space-between, so it reads the same on mobile and desktop). It is
  **pinned just above the on-screen keyboard** — see *Editor keyboard (RichEditor)*
  under the Scroll model section for exactly how (it differs embedded vs standalone,
  and both paths rely on the scroll container ending at the keyboard top). It can be **tucked
  away** to an "Aa" chip (persisted in `localStorage['notes_fmtbar_open']`) with a
  grow/shrink animation (`.pill-pop` in `globals.css`). Row 1 also has a **break-out**
  button (`detachBlock`) that toggles `data-detached` on the caret's block so a body
  paragraph can be excluded from its heading's collapse group (styled with an accent
  left border). Links open on a plain tap.
- **To-Do List** — a flat, borderless checklist (`items[]` with `done`), tap to
  complete. **Press Enter** in a row to insert a new item right after it and
  focus it (`insertAfter` in `ChecklistEditor`); **Backspace on an empty row**
  deletes it and moves focus to the previous row — the iOS Notes/Reminders
  checklist feel. Items default to **no due date**; each row has a small,
  muted calendar-icon affordance (`DueChip`) as the "subtle way to add a due
  date" — tapping it opens the native date picker inline, no dialog. Once a
  date is set, items that **share the same due date auto-cluster** under one
  small date heading below the undated list (grouping is automatic — there's no
  manual "create a group" step, just set the same date on a few items and
  they'll land together, sorted soonest-first).
- **Grocery List** — checklist grouped by aisle/category (`items[]` with `category` from `GROCERY_CATEGORIES`).
- **Project Timeline** — milestone rows with a target `date` and done state.
- **Meal Plan** — weekly grid, 7 days × Breakfast/Lunch/Dinner (`items[]` keyed by `day` + `slot`).

Every structured note also has a freeform **Notes** field (`body`) at the bottom
(borderless auto-growing textarea; only Blank notes use the rich editor for `body`).

### Freeform styling (2026-07-12)
The note editor page (`app/note/[noteId]/page.tsx`) and `RichEditor.tsx` were
stripped of card/box chrome to feel like a boundless canvas rather than a form:
- `inputSx` (shared by Grocery/Timeline/Meal text + date fields, and the Share
  sheet's email input) is now a **bottom-underline field**, not a bordered box:
  `background: transparent; border: none; border-bottom: 1px solid`.
- `AddRowBtn` ("Add item" / "Add milestone" / …) lost its dashed-border box —
  it's now a plain muted text row.
- `AutoTextarea` (the freeform Notes field under structured note types) lost its
  background + border box — transparent, just padding.
- `RichEditor`'s contentEditable lost its background + border box entirely —
  transparent, inherits the note page's own padding instead of adding its own.
- The Grocery category `<select>` matches the new underline style.
- **Scope**: this applies to note *content* editors. The Home list (`NoteCard`,
  a `Glass` card), the `/new` template picker, and Settings still use the
  Liquid Glass card style — those are navigation chrome, not note content, and
  stay legible as a scannable list/menu.

### Due dates
`item.date` (yyyy-mm-dd) is a **due date** on To-Do items and a **milestone date**
on Timeline items. `dueInfo(date, done)` in `lib/notes.ts` classifies it as
`overdue | today | soon (≤3d) | later` with a label; the note cards and the AIO
dashboard both use it. New notes suggest **existing folder names** via a `<datalist>`
on the folder input in the editor (`ownedNotesQuery` gathers the user's folders).

## Pages / routes
```
/                  Home — my notes AND notes shared with me, folder filter pills,
                   search (via the bottom pill), + New
/new               Template picker → creates a note, redirects to /note/[id]
/note/[noteId]     Full-screen editor (all 5 types), autosave, Share, Delete
/shared            Redirects to / — kept only so old links/bookmarks don't 404
/settings          Account, accent color picker, sign out
```
The bottom pill (search + Settings) is hidden on `/note/[...]` so the editor gets
the full screen.

### Search
The bottom pill's search box (`BottomNav` in `NotesShell.tsx` — name kept from
the old tab-bar component to avoid touching `BottomNavWrapper.tsx`, but it's a
search box now, not tabs) is the **single always-mounted search input**,
connected to the Home page via a small React context (`SearchContext.tsx`,
provided in `layout.tsx`) since the pill and Home are separate components under
the root layout. Typing while on any other route (`/new`, `/settings`, the
redirecting `/shared`) immediately routes to `/` so results are visible.
`noteMatchesSearch(note, query)` in `lib/notes.ts` matches **title, the note's
Folder (doubles as its one "tag"), the freeform body (HTML-stripped), and every
checklist/timeline/meal item's text** — i.e. anything a person would think of as
"the note's content". There's no separate multi-tag field; Folder was chosen as
the tag for search to avoid a schema change (decision made 2026-07-12 — revisit
if a note ever needs more than one tag).

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
`unshareNote` removes it (`arrayRemove`). Recipients find the note **on Home**,
mixed in with their own notes (matched by their Google email) — `NoteCard` gets
an `isOwner` prop and shows a **"Shared" tag** instead of the share-count badge
when the viewer isn't the owner. Only the **owner** sees the Share and Delete
controls in the editor; recipients see a "Shared with you" tag there too.

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
`AddBtn`, `PillBtn`, `BottomNav` (now the search+Settings pill — see *Search*).
Card component: `app/components/NoteCard.tsx`. Search state:
`app/components/SearchContext.tsx`.

### Scroll model — app shell, one inner scroll layer (iOS/iframe safe)
The scroll model is **conditional on embedding**, driven by `data-embedded="1"`
on `<html>` (set by an inline script in `layout.tsx` before paint when
`window.self !== window.top`). `NotePage` always renders `.note-shell` >
`.notes-scroll`; `globals.css` styles them per mode:

- **Standalone** (own tab / added-to-home-screen): the **document scrolls**
  (`.note-shell { min-height:100dvh }`, `.notes-scroll` is a plain block). This
  is essential — a non-scrolling page stops iOS Safari from collapsing its
  bottom toolbar, which showed up as a **black box** at the bottom. Document
  scroll = toolbar collapses = full-screen.
- **Embedded in the AIO iframe** (`html[data-embedded="1"]`): the document is
  locked (`body { position:fixed; inset:0; overflow:hidden }`) and only the inner
  **`.notes-scroll`** region scrolls (`flex:1; overflow-y:auto;
  overscroll-behavior:contain`). This stops iOS from auto-expanding the iframe to
  content height and chaining scroll into the parent (which clipped the "Return
  to AIO" header and un-pinned the bottom-nav pill).

`BottomNav`'s hide-on-scroll listens on `window` (standalone) or `.notes-scroll`
(embedded) accordingly. This is required
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

**Editor keyboard (RichEditor).** Core insight from debugging on iOS: the pill is
only ever rock-solid when **the document doesn't scroll and the app shell ends
exactly at the keyboard top**. iOS doesn't resize the layout viewport for the
keyboard — it shrinks the visual viewport and, when you tap low on the note,
*pans* it (`visualViewport.offsetTop > 0`); any kb math that ignores the pan puts
the pill behind the keyboard, and the panned-off top of the page becomes
unreachable until the keyboard closes. iOS also un-pins `position:fixed` elements
while a keyboard-open *document* scrolls (the standalone pill lag). So both modes
now converge on the same model while the keyboard is open:

- **Embedded**: the AIO `/notes` page fits its fixed container to the visual
  viewport (`top = vv.offsetTop`, `height = vv.height`) whenever its measured
  keyboard height (`innerHeight - vv.height`, toolbar-immune) is > 60px, so the
  iframe always ends at the keyboard top. The `aio-kb` postMessage now carries
  that true height and the editor uses it **only as an "open?" signal** — the
  pill just hugs the iframe bottom (`bottom: 8`). No pan math in the iframe.
- **Standalone**: while `kb > 60`, RichEditor sets `html[data-kb="1"]`
  (globals.css), which locks the document into the embedded scroll model AND fits
  `.note-shell` to the visual viewport via `--vvt`/`--vvh` (kept in sync on vv
  resize/scroll). Scroll position is carried document ⇄ `.notes-scroll` on
  lock/unlock. The document never scrolls/pans → the fixed pill tracks with
  **zero lag** and the whole note stays scrollable. Unlocked on keyboard
  dismiss so Safari's toolbar-collapse (needs a scrolling document) keeps
  working. The pill is **top-anchored purely from the visual viewport**
  (`pillTop = vv.offsetTop + vv.height − pillHeight − 8`, re-measured when the
  bar ⇄ "Aa" chip toggles) — an `innerHeight`-based `bottom: kb + 8` lift
  overshot by Safari's toolbar delta when focusing at scroll-top (chrome
  expanded), leaving the pill slightly too high.

The pill has **no CSS transition** on `bottom` (a transition = visible lag).
The contentEditable keeps only its 96px base bottom padding (pill clearance) —
no keyboard inset needed in either mode, since the scroll container ends at the
keyboard top.

**Scroll performance.** The decorative glow/grain layers in `NotePage` are
`position: fixed` (not `absolute`). Standalone the document scrolls, and blurred/
noise layers that scroll with it get repainted every frame → visible stutter.
Fixed keeps them pinned to the viewport so only the content scrolls.

**No zoom.** All editables are ≥ 16px (globals force inputs to 16px; the
contentEditable `.rich-editor` is 16px) so iOS never focus-zooms a text field.
`body` has `touch-action:manipulation` (no double-tap zoom) and
`BottomNavWrapper` preventDefaults `gesturestart/change/end` to block pinch-zoom,
since iOS ignores the viewport `maximum-scale`/`user-scalable` hints.

## Key files
```
app/
  layout.tsx                    # AuthGate + SearchProvider + persistent BottomNavWrapper
  page.tsx                      # Home (owned + shared notes merged, folder filter, search)
  new/page.tsx                  # Template picker
  note/[noteId]/page.tsx        # Editor (all types) + Share sheet + delete
  shared/page.tsx               # Redirects to / (route kept for old links only)
  settings/page.tsx             # Account, accent, sign out
  components/
    NotesShell.tsx              # Design system (tokens + components + BottomNav search pill)
    NoteCard.tsx                # Note list card (isOwner prop → "Shared" tag)
    SearchContext.tsx           # Global search-query context (pill ⇄ Home)
    AuthGate.tsx                # Google sign-in (+ ?token= silent sign-in)
    BottomNavWrapper.tsx        # Mounts the pill; hides on /note/*; syncs accent
  globals.css                   # Fonts + Liquid Glass + no-zoom rules + rich-editor type sizes
lib/
  firebase.ts                   # Firebase init (shared config)
  notes.ts                      # Note types, queries, CRUD, sharing helpers, noteMatchesSearch
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
- Full app: Home (owned + shared notes merged), template picker, editor for all
  5 note types, Settings.
- Folder organization (free-text folder + Home filter pills); folder also
  doubles as the note's searchable "tag".
- Share individual notes by Google email (view + edit); shared notes appear on
  Home with a "Shared" tag.
- Search (title / body / folder / item text) via the bottom pill.
- Debounced autosave with idle remote-sync.
- Accent theming; Liquid Glass design system ported from FitShell (kept for
  navigation chrome — Home cards, template picker, Settings — see *Freeform
  styling*).
- Freeform, low-chrome note editors (Blank Note is a borderless page; To-Do is
  a flat Enter-to-add checklist with auto-clustering due dates; structured
  fields use an underline instead of a boxed card).
- AIO integration: Projects tile → Notes, `/notes` iframe route + token.

### Added later
- **Rich-text Blank notes** (headings, B/I/U/S, auto-bullets, indent, links, collapsible headings).
- **Folder suggestions** (datalist of existing folders) in the note editor.
- **Due dates** on To-Do items; due dates + Timeline milestones surfaced on the AIO dashboard.
- **App-shell scroll model** (one inner `.notes-scroll` layer) — fixes iframe-only
  layering/scroll bugs on iOS: bottom pill now stays pinned, and AIO's
  "Return to AIO" header no longer gets scrolled/clipped on the home screen.
- **Keyboard-open viewport fitting (2026-07-03)** — fixes three iOS bugs: pill
  behind the keyboard when tapping mid/bottom of a note in the AIO iframe,
  limited scroll-up while the keyboard was open in the iframe, and pill lag when
  scrolling standalone. AIO fits the iframe container to the visual viewport
  while the keyboard is open; standalone locks into `html[data-kb="1"]` (see
  *Editor keyboard (RichEditor)* above).
- **Merged Shared into Home + search pill + freeform note editors (2026-07-12)**
  — Home now shows owned + shared notes together (`isOwner` tag on the card);
  `/shared` just redirects there. The old Notes/Shared/Settings tab bar was
  replaced with a search box + Settings button (search covers title, body,
  folder-as-tag, and item text — see *Search*). Blank Note lost its card
  (borderless page, smaller headings) and the To-Do list became a flat,
  Enter-to-add checklist with a subtle per-row due-date icon and automatic
  same-date clustering. Grocery/Timeline/Meal fields and "Add row" buttons
  switched from boxed cards to underlines/plain rows (see *Freeform styling*).

### Not yet done / ideas
- Deploy to Vercel (needs GitHub repo + Vercel project; URL confirm).
- Optional tighter Firestore rules for `notes` (see above).
- Per-share view-only permission, live co-editing merge, drag-reorder items.
- A real multi-tag field, if Folder-as-tag ever feels too limiting (see *Search*).
