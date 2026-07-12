'use client'
import { createContext, useContext, useState } from 'react'

// Global search query — the bottom bar's search box is mounted once (persistent
// across routes, like the old BottomNav), while the filtering happens on the
// Home page. A tiny context is the simplest way to connect the two without prop
// drilling through the root layout.
interface SearchCtx { query: string; setQuery: (q: string) => void }
const Ctx = createContext<SearchCtx>({ query: '', setQuery: () => {} })

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  return <Ctx.Provider value={{ query, setQuery }}>{children}</Ctx.Provider>
}

export function useSearch(): SearchCtx {
  return useContext(Ctx)
}
