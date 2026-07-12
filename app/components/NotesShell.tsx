'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSearch } from './SearchContext'

// ─── Design tokens (mirrors AIOShell / FitShell — notes accent) ──────────────
export const N = {
  bg:        '#0a0a0c',
  surface:   'rgba(255,255,255,0.10)',
  surfaceHi: 'rgba(255,255,255,0.16)',
  border:    'rgba(255,255,255,0.10)',
  borderHi:  'rgba(255,255,255,0.18)',
  text:      '#f2f2f4',
  textSec:   'rgba(255,255,255,0.70)',
  textMut:   'rgba(255,255,255,0.45)',
  textDim:   'rgba(255,255,255,0.25)',
  note:      'var(--na)',   // accent — controlled by CSS custom property --na
  ok:        '#7cc98c',
  warn:      '#d87a7a',
  font:      '"DM Sans", system-ui, sans-serif',
  mono:      '"DM Mono", ui-monospace, monospace',
  bebas:     '"Bebas Neue", sans-serif',
}

/** Accent color with alpha — produces a color-mix() CSS expression. */
export const noteA = (hexOpacity: string): string => {
  const pct = Math.round(parseInt(hexOpacity, 16) / 2.55)
  return `color-mix(in srgb, var(--na) ${pct}%, transparent)`
}

/** Preset accent themes. */
export const ACCENT_THEMES = [
  { name: 'Violet', hex: '#8a7ad8' },
  { name: 'Ocean',  hex: '#5b8fd4' },
  { name: 'Sage',   hex: '#5ba871' },
  { name: 'Amber',  hex: '#d4995b' },
  { name: 'Rose',   hex: '#cc6b7a' },
  { name: 'Slate',  hex: '#7c8fa8' },
] as const

/** Apply an accent color: updates the CSS variable and persists to localStorage. */
export function applyAccent(hex: string) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--na', hex)
  try { localStorage.setItem('notes_accent', hex) } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('notes-accent-change', { detail: { hex } }))
}

/** Call once on app mount to restore the saved accent color. */
export function restoreAccent() {
  if (typeof document === 'undefined') return
  try {
    const saved = localStorage.getItem('notes_accent')
    if (saved) document.documentElement.style.setProperty('--na', saved)
  } catch { /* ignore */ }
}

// ─── Grain SVG ────────────────────────────────────────────────────────────────
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")"

// ─── NotePage — full-screen shell ────────────────────────────────────────────
export function NotePage({ children }: { children: React.ReactNode }) {
  // Layout (scroll model) is driven by CSS in globals.css — `.note-shell` +
  // `.notes-scroll`, which behave differently standalone vs. embedded in the AIO
  // iframe (see `html[data-embedded]`). Keeps the JSX identical for both.
  return (
    <div className="note-shell" style={{ fontFamily: N.font }}>
      {/* Decorative glows + grain — `position: fixed` so they stay pinned to the
          viewport and are NOT repainted as the document scrolls (standalone).
          Repainting these blurred/noise layers every scroll frame was the cause
          of the standalone scroll stutter. */}
      <div style={{
        position: 'fixed', top: -180, left: -120, width: 420, height: 420,
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(circle, ${noteA('28')} 0%, ${noteA('0c')} 35%, transparent 70%)`,
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'fixed', bottom: -220, right: -140, width: 440, height: 440,
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(circle, ${noteA('1c')} 0%, ${noteA('08')} 40%, transparent 70%)`,
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        opacity: 0.035, backgroundImage: GRAIN,
      }} />
      <div className="notes-scroll">
        {children}
      </div>
    </div>
  )
}

// ─── Glass card ───────────────────────────────────────────────────────────────
interface GlassProps {
  children: React.ReactNode
  p?: number
  accent?: string
  style?: React.CSSProperties
  onClick?: () => void
}
export function Glass({ children, p = 16, accent, style, onClick }: GlassProps) {
  const interactive = !!onClick
  const onPointerMove = interactive
    ? (e: React.PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--lg-mx', `${((e.clientX - r.left) / r.width) * 100}%`)
        e.currentTarget.style.setProperty('--lg-my', `${((e.clientY - r.top) / r.height) * 100}%`)
      }
    : undefined
  return (
    <div
      onClick={onClick}
      onPointerMove={onPointerMove}
      className={`liquid-glass${interactive ? ' lg-interactive' : ''}`}
      style={{
        borderRadius: 16,
        padding: p,
        ...(accent ? { ['--lg-accent' as string]: accent + '30' } : {}),
        ...style,
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}

// ─── PageHead — eyebrow + Bebas title + optional back + trailing slot ─────────
interface PageHeadProps {
  eyebrow?: string
  title: string
  back?: boolean
  trail?: React.ReactNode
}
export function PageHead({ eyebrow, title, back = false, trail }: PageHeadProps) {
  const router = useRouter()
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '0 20px 4px',
      // Swiping on the title header shouldn't start a scroll/overscroll — that
      // was re-triggering the iframe layering glitch. Taps (＋, back) still work.
      touchAction: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {back && (
          <button
            onClick={() => router.back()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: N.textMut, padding: '0 4px 0 0', lineHeight: 1,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <p style={{
              fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
              color: N.textMut, margin: '0 0 2px',
            }}>
              {eyebrow}
            </p>
          )}
          <h1 style={{
            fontFamily: N.bebas, fontSize: 'clamp(2rem, 8vw, 3rem)',
            lineHeight: 0.92, letterSpacing: '0.04em', margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </h1>
        </div>
      </div>
      {trail && <div style={{ flexShrink: 0 }}>{trail}</div>}
    </div>
  )
}

// ─── SectionLbl ───────────────────────────────────────────────────────────────
export function SectionLbl({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: N.textMut }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: N.border }} />
    </div>
  )
}

// ─── StatPill — small metric badge ───────────────────────────────────────────
export function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="liquid-glass" style={{
      borderRadius: 12, padding: '8px 14px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontFamily: N.mono, fontWeight: 600, color: color || N.note }}>
        {value}
      </div>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: N.textMut, marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

// ─── AddBtn — circle outline button for trailing slot ─────────────────────────
export function AddBtn({ onClick }: { label?: string; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label="Add"
      style={{
        background: 'transparent',
        border: `2px solid ${N.note}`,
        borderRadius: '50%',
        color: N.note,
        fontSize: 24,
        fontWeight: 300,
        width: 38,
        height: 38,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        fontFamily: N.font,
        flexShrink: 0,
      }}
    >
      +
    </button>
  )
}

// ─── Pill button (opaque accent) ──────────────────────────────────────────────
export function PillBtn({ children, onClick, disabled, ghost }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; ghost?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="lg-press"
      style={{
        background: ghost ? 'transparent' : N.note,
        color: ghost ? N.note : '#0a0a0c',
        border: ghost ? `1.5px solid ${noteA('66')}` : 'none',
        borderRadius: 100, padding: '11px 20px',
        fontSize: 14, fontWeight: 700, fontFamily: N.font,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

// ─── BottomBar — search box + settings button (replaces the old tab nav) ─────
// The search box is the single always-mounted input; typing it updates
// SearchContext, which the Home page reads to filter notes. Typing while on any
// other route jumps to Home so results are visible immediately.
export function BottomNav() {
  const router   = useRouter()
  const pathname = usePathname()
  const { query, setQuery } = useSearch()

  const [visible,   setVisible]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [focused,   setFocused]   = useState(false)
  const lastY = useRef(0)

  const onHome     = pathname === '/'
  const onSettings = pathname === '/settings' || !!pathname?.startsWith('/settings/')

  // Hide-on-scroll target depends on the scroll model: the window when standalone
  // (document scrolls), or the inner `.notes-scroll` region when embedded in the
  // AIO iframe. Re-bind per route since each page mounts its own container.
  useEffect(() => {
    const embedded = document.documentElement.dataset.embedded === '1'
    const el = embedded ? (document.querySelector('.notes-scroll') as HTMLElement | null) : null
    if (embedded && !el) { setVisible(true); return }
    const getY = () => (el ? el.scrollTop : window.scrollY)
    const target: EventTarget = el ?? window
    lastY.current = getY()
    const onScroll = () => {
      const y = getY()
      if      (y < 16)                 setVisible(true)
      else if (y < lastY.current - 32) setVisible(true)
      else if (y > lastY.current + 8)  setVisible(false)
      lastY.current = y
    }
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [pathname])

  useEffect(() => {
    const sync = () => setModalOpen(document.body.hasAttribute('data-modal'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-modal'] })
    return () => observer.disconnect()
  }, [])

  return (
    <nav style={{
      // Embedded in the AIO iframe, env(safe-area-inset-bottom) reads 0, so also
      // honor --aio-safe-bottom (the real inset the AIO parent posts in). Uses
      // whichever is larger, so standalone and embedded both clear the indicator.
      position: 'fixed', bottom: 'calc(max(env(safe-area-inset-bottom), var(--aio-safe-bottom, 0px)) + 16px)',
      left: '50%', width: 'min(420px, calc(100vw - 32px))',
      transform: `translateX(-50%) translateY(${visible && !modalOpen ? '0' : 'calc(100% + env(safe-area-inset-bottom) + 32px)'})`,
      transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
      background: 'linear-gradient(180deg, rgba(30,30,36,0.78) 0%, rgba(12,12,16,0.85) 100%)',
      border: `1px solid rgba(255,255,255,0.12)`,
      borderRadius: 28, padding: '6px 6px 6px 16px',
      display: 'flex', alignItems: 'center', gap: 8,
      backdropFilter: 'blur(30px) saturate(180%) brightness(1.06)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%) brightness(1.06)',
      boxShadow: [
        'inset 0 1px 0 rgba(255,255,255,0.22)',
        'inset 0 0 0 1px rgba(255,255,255,0.05)',
        'inset 0 -8px 18px -12px rgba(255,255,255,0.10)',
        '0 8px 40px rgba(0,0,0,0.5)',
        '0 1px 2px rgba(0,0,0,0.4)',
      ].join(', '),
      zIndex: 100,
    }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}
        stroke={focused ? N.note : N.textMut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); if (!onHome) router.push('/') }}
        onFocus={() => { setFocused(true); if (!onHome) router.push('/') }}
        onBlur={() => setFocused(false)}
        placeholder="Search notes…"
        aria-label="Search notes"
        style={{
          flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
          color: N.text, fontFamily: N.font, fontSize: 15, padding: '10px 0',
        }}
      />
      {query && (
        <button onClick={() => setQuery('')} aria-label="Clear search" style={{
          background: 'none', border: 'none', color: N.textDim, cursor: 'pointer',
          padding: 4, display: 'flex', flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      )}
      <div style={{ width: 1, alignSelf: 'stretch', margin: '6px 0', background: N.border, flexShrink: 0 }} />
      <button
        onClick={() => { if (!onSettings) router.push('/settings') }}
        aria-label="Settings"
        title="Settings"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          border: 'none', background: onSettings ? noteA('22') : 'transparent',
          cursor: onSettings ? 'default' : 'pointer',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke={onSettings ? N.note : N.textMut} strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </nav>
  )
}
