'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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
  return (
    // Non-scrolling shell that exactly fills the viewport (or the AIO iframe).
    // Scrolling happens ONLY in the inner `.notes-scroll` region below, so the
    // bottom-nav pill stays pinned and scroll never chains out to the AIO parent.
    <div style={{
      height: '100%', background: N.bg, color: N.text,
      fontFamily: N.font, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Decorative glows — anchored to the shell (absolute, not fixed) so they
          stay put behind the scrolling content. */}
      <div style={{
        position: 'absolute', top: -180, left: -120, width: 420, height: 420,
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(circle, ${noteA('28')} 0%, ${noteA('0c')} 35%, transparent 70%)`,
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', bottom: -220, right: -140, width: 440, height: 440,
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(circle, ${noteA('1c')} 0%, ${noteA('08')} 40%, transparent 70%)`,
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        opacity: 0.035, backgroundImage: GRAIN,
      }} />
      <div className="notes-scroll" style={{
        position: 'relative', zIndex: 1,
        flex: 1, minHeight: 0, overflowY: 'auto',
      }}>
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

// ─── BottomNav (fixed pill, animated blob indicator) ─────────────────────────
const NAV = [
  { label: 'Notes',    href: '/',         icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5' },
  { label: 'Shared',   href: '/shared',   icon: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M8.6 13.5l6.8 3.9 M15.4 6.6l-6.8 3.9' },
  { label: 'Settings', href: '/settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
] as const

interface IndicatorState { x: number; w: number; transition: string }

export function BottomNav() {
  const router   = useRouter()
  const pathname = usePathname()

  const [indicator, setIndicator] = useState<IndicatorState>({ x: 0, w: 0, transition: 'none' })
  const tabRefs     = useRef<(HTMLButtonElement | null)[]>([])
  const prevIdx     = useRef<number>(-1)
  const initialized = useRef(false)

  const [visible,   setVisible]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const lastY = useRef(0)

  const activeHref = NAV.reduce<string | null>((best, n) => {
    const match = n.href === '/'
      ? pathname === '/'
      : pathname === n.href || pathname?.startsWith(n.href + '/')
    if (!match) return best
    if (!best || n.href.length > best.length) return n.href
    return best
  }, null)

  const activeIdx = NAV.findIndex(n => n.href === activeHref)

  useEffect(() => {
    if (activeIdx < 0) return
    const el = tabRefs.current[activeIdx]
    if (!el) return
    const container = el.parentElement
    if (!container) return

    const cRect = container.getBoundingClientRect()
    const rect  = el.getBoundingClientRect()
    const destX = rect.left - cRect.left
    const destW = rect.width

    const prev   = prevIdx.current
    const prevEl = prev >= 0 ? tabRefs.current[prev] : null

    if (!initialized.current || !prevEl || prev === activeIdx) {
      setIndicator({ x: destX, w: destW, transition: 'none' })
      prevIdx.current     = activeIdx
      initialized.current = true
      return
    }

    const pRect    = prevEl.getBoundingClientRect()
    const stretchX = Math.min(rect.left, pRect.left) - cRect.left
    const stretchW = Math.max(rect.right, pRect.right) - Math.min(rect.left, pRect.left)

    setIndicator({
      x: stretchX,
      w: stretchW,
      transition: 'left 130ms cubic-bezier(0.4,0,0.2,1), width 130ms cubic-bezier(0.4,0,0.2,1)',
    })

    const tid = setTimeout(() => {
      setIndicator({
        x: destX,
        w: destW,
        transition: 'left 360ms cubic-bezier(0.34,1.56,0.64,1), width 360ms cubic-bezier(0.34,1.56,0.64,1)',
      })
      prevIdx.current = activeIdx
    }, 115)

    return () => clearTimeout(tid)
  }, [activeIdx])

  // Scrolling lives in the page's inner `.notes-scroll` region (see NotePage),
  // not on the window — so hide-on-scroll listens there. Re-bind per route since
  // each page mounts its own scroll container.
  useEffect(() => {
    const el = document.querySelector('.notes-scroll') as HTMLElement | null
    if (!el) { setVisible(true); return }
    lastY.current = el.scrollTop
    const onScroll = () => {
      const y = el.scrollTop
      if      (y < 16)                 setVisible(true)
      else if (y < lastY.current - 32) setVisible(true)
      else if (y > lastY.current + 8)  setVisible(false)
      lastY.current = y
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
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
      left: '50%',
      transform: `translateX(-50%) translateY(${visible && !modalOpen ? '0' : 'calc(100% + env(safe-area-inset-bottom) + 32px)'})`,
      transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
      background: 'linear-gradient(180deg, rgba(30,30,36,0.78) 0%, rgba(12,12,16,0.85) 100%)',
      border: `1px solid rgba(255,255,255,0.12)`,
      borderRadius: 28, padding: '10px 6px',
      display: 'flex', gap: 2,
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

      <div style={{
        position:     'absolute',
        top:          10,
        bottom:       10,
        left:         indicator.x,
        width:        indicator.w,
        borderRadius: 20,
        background:   `linear-gradient(180deg, ${noteA('34')} 0%, ${noteA('1c')} 100%)`,
        border:       `1px solid ${noteA('55')}`,
        backdropFilter: 'brightness(1.18) saturate(1.4)',
        WebkitBackdropFilter: 'brightness(1.18) saturate(1.4)',
        transition:   indicator.transition,
        pointerEvents: 'none',
        zIndex:       0,
        boxShadow:    `inset 0 1px 0 ${noteA('66')}, inset 0 -2px 6px -3px ${noteA('40')}, 0 0 16px -2px ${noteA('3a')}`,
        opacity:      indicator.w > 0 ? 1 : 0,
      }} />

      {NAV.map((n, i) => {
        const isActive = activeHref === n.href
        return (
          <button
            key={n.href}
            ref={el => { tabRefs.current[i] = el }}
            onClick={() => { if (!isActive) router.push(n.href) }}
            aria-label={n.label}
            title={n.label}
            style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px 22px', borderRadius: 20,
              border: 'none', background: 'none',
              cursor: isActive ? 'default' : 'pointer',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={isActive ? N.note : N.textMut}
              strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
              {n.icon.split(' M').map((d, j) => (
                <path key={j} d={j === 0 ? d : 'M' + d} />
              ))}
            </svg>
          </button>
        )
      })}
    </nav>
  )
}
