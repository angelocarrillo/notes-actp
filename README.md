# Notes — Joint AIO App

A shared, mobile-first notes app for the household. Jot down notes, organize them
into folders, spin up notes from templates (To-Do, Project Timeline, Grocery List,
Meal Plan), and share individual notes with other people by their Google account.

Part of the **Joint AIO** Cowork project. Same stack and Firebase project as
`fitness-app` and `finance-dashboard`. Replaces the "Projects" card in the AIO
dashboard.

## Stack
- Next.js 16 (App Router) + TypeScript 5
- Inline styles only — Liquid Glass design system (`NotesShell`)
- Firebase Firestore + Auth (Google Sign-in), shared project
- Deployed on Vercel via `git push`

## Local dev
```
npm install
npm run dev
```
Requires a `.env.local` with the shared `NEXT_PUBLIC_FIREBASE_*` values (copy from
`finance-dashboard/.env.local`).

See `CONTEXT.md` for architecture, data model, and deploy steps.
