'use client'
import { useEffect, useRef, useState } from 'react'
import { N, noteA } from './NotesShell'

// A dependency-free rich-text editor built on contentEditable + execCommand.
// Stores/returns HTML. Supports: Title/Heading/Subheading/Body blocks,
// bold/italic/underline/strikethrough, auto-bullets on "-", Tab indent for
// sub-bullets, hyperlinks, and collapsible headings.

function headingLevel(el: Element): number {
  return el.tagName === 'H1' ? 1 : el.tagName === 'H2' ? 2 : el.tagName === 'H3' ? 3 : 0
}

/** Hide/show blocks based on which headings are marked data-collapsed. */
function applyCollapse(root: HTMLElement) {
  const stack: number[] = []
  for (const child of Array.from(root.children)) {
    const el  = child as HTMLElement
    const lvl = headingLevel(el)
    if (lvl > 0) while (stack.length && lvl <= stack[stack.length - 1]) stack.pop()
    // Blocks marked data-detached stay visible even inside a collapsed section.
    const hidden = stack.length > 0 && el.dataset.detached !== 'true'
    el.style.display = hidden ? 'none' : ''
    if (lvl > 0 && !hidden && el.dataset.collapsed === 'true') stack.push(lvl)
  }
}

export function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref     = useRef<HTMLDivElement | null>(null)
  const focused = useRef(false)

  // Floating formatting pill: open/tucked-away state (persisted) + position.
  const [barOpen, setBarOpen] = useState(true)
  const pillRef = useRef<HTMLDivElement | null>(null)
  // Current on-screen keyboard height (0 when closed). The pill is anchored to
  // the bottom and lifted by this — position-independent, so it stays just above
  // the keyboard no matter where in the note you tapped.
  const [kb, setKb] = useState(0)
  // Whether we're embedded in the AIO iframe (set after mount to avoid a hydration
  // mismatch). Embedded, the parent resizes the iframe to the visual viewport
  // while the keyboard is open, so the pill hugs the iframe bottom; standalone
  // it's lifted by the measured keyboard height instead.
  const [embedded, setEmbedded] = useState(false)
  useEffect(() => { setEmbedded(window.self !== window.top) }, [])
  // Keyboard height reported by the AIO parent (via postMessage) when this app is
  // embedded in the AIO iframe — inside a cross-origin iframe the VisualViewport
  // API does NOT reflect the on-screen keyboard, so we rely on the parent.
  const parentKb = useRef<number | null>(null)

  useEffect(() => {
    try { const s = localStorage.getItem('notes_fmtbar_open'); if (s === '0') setBarOpen(false) } catch { /* ignore */ }
  }, [])
  const toggleBar = (open: boolean) => {
    setBarOpen(open)
    try { localStorage.setItem('notes_fmtbar_open', open ? '1' : '0') } catch { /* ignore */ }
  }

  // Track the on-screen keyboard height.
  // - Embedded: the AIO parent fits the iframe to the visual viewport while the
  //   keyboard is open (the iframe always ends at the keyboard top), and sends
  //   the real keyboard height via `aio-kb` — here it's only an "open?" signal.
  // - Standalone: while the keyboard is open we lock the document into the
  //   embedded scroll model (html[data-kb="1"] in globals.css) and fit the
  //   shell to the visual viewport. The document then never scrolls/pans, so
  //   the fixed pill tracks scrolling with zero lag and the inner scroller can
  //   reach the whole note.
  useEffect(() => {
    const scroller = () => document.querySelector('.notes-scroll') as HTMLElement | null
    const syncStandaloneLock = (kbNow: number) => {
      if (window.self !== window.top) return
      const html = document.documentElement
      const vv = window.visualViewport
      const locked = html.dataset.kb === '1'
      if (kbNow > 60) {
        if (!locked) {
          // Lock, carrying the document scroll position into the inner scroller.
          const y = window.scrollY
          html.dataset.kb = '1'
          const sc = scroller()
          if (sc) sc.scrollTop = y
        }
        if (vv) {
          html.style.setProperty('--vvt', `${vv.offsetTop}px`)
          html.style.setProperty('--vvh', `${vv.height}px`)
        }
      } else if (locked) {
        // Unlock, carrying the scroll position back to the document.
        const sc = scroller()
        const y = sc ? sc.scrollTop : 0
        delete html.dataset.kb
        html.style.removeProperty('--vvt')
        html.style.removeProperty('--vvh')
        window.scrollTo(0, y)
      }
    }
    const measure = () => {
      const vv = window.visualViewport
      const inIframe = window.self !== window.top
      const ownKb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
      const kbNow = ownKb > 60 ? ownKb : (inIframe ? (parentKb.current ?? 0) : 0)
      syncStandaloneLock(kbNow)
      setKb(prev => (Math.abs(prev - kbNow) > 1 ? kbNow : prev))
    }
    let ticking = false
    const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; measure() }) } }
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'aio-kb' && typeof e.data.kb === 'number') {
        parentKb.current = e.data.kb
        schedule()
      }
    }
    measure()
    const vv = window.visualViewport
    vv?.addEventListener('resize', schedule)
    vv?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('message', onMsg)
    return () => {
      vv?.removeEventListener('resize', schedule)
      vv?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('message', onMsg)
      syncStandaloneLock(0)   // never leave the document locked on unmount
    }
  }, [])

  // Initialize / sync innerHTML when not actively editing.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!focused.current && value !== el.innerHTML) {
      el.innerHTML = value || ''
      applyCollapse(el)
      syncEmpty(el)
    }
  }, [value])

  const syncEmpty = (el: HTMLElement) => {
    el.dataset.empty = (el.textContent ?? '').trim() === '' && !el.querySelector('img, hr, li') ? 'true' : 'false'
  }

  const emit = () => { const el = ref.current; if (el) { syncEmpty(el); onChange(el.innerHTML) } }

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    emit()
  }

  const setBlock = (tag: string) => {
    ref.current?.focus()
    document.execCommand('formatBlock', false, tag)
    emit()
  }

  const addLink = () => {
    const url = window.prompt('Link URL (https://…)')
    if (!url) return
    const href = /^(https?:|mailto:)/i.test(url) ? url : 'https://' + url
    exec('createLink', href)
  }

  // Toggle whether the block at the caret is "detached" from its heading's
  // collapse group (stays visible even when the heading above it is collapsed).
  const detachBlock = () => {
    const el = ref.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    let node: Node | null = sel.getRangeAt(0).startContainer
    while (node && node.parentElement !== el) node = node.parentElement
    const block = node as HTMLElement | null
    if (!block || block === el) return
    block.dataset.detached = block.dataset.detached === 'true' ? 'false' : 'true'
    applyCollapse(el)
    emit()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Tab / Shift+Tab → indent / outdent (sub-bullets)
    if (e.key === 'Tab') {
      e.preventDefault()
      exec(e.shiftKey ? 'outdent' : 'indent')
      return
    }
    // "- " at the start of a line → bullet list
    if (e.key === ' ') {
      const sel = window.getSelection()
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0)
        const node  = range.startContainer
        const before = (node.textContent || '').slice(0, range.startOffset)
        if (before === '-' && node.nodeType === Node.TEXT_NODE) {
          e.preventDefault();
          (node as Text).deleteData(range.startOffset - 1, 1)
          exec('insertUnorderedList')
        }
      }
    }
  }

  // Gutter click on a heading → toggle collapse. Cmd/Ctrl+click a link → open it.
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (headingLevel(t) > 0 && e.nativeEvent.offsetX < 22) {
      e.preventDefault()
      t.dataset.collapsed = t.dataset.collapsed === 'true' ? 'false' : 'true'
      if (ref.current) applyCollapse(ref.current)
      emit()
    }
  }

  // Tap a link to open it (works on mobile — no modifier key needed).
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
    if (a && a.getAttribute('href')) { e.preventDefault(); window.open(a.href, '_blank', 'noopener') }
  }

  // Paste as plain text so pasted content inherits this note's font/color/size
  // instead of carrying over the source app's styling (Apple Notes, web pages…).
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    // Insert line by line so newlines become new blocks/breaks, not lost.
    const lines = text.split(/\r?\n/)
    lines.forEach((line, i) => {
      if (i > 0) document.execCommand('insertParagraph')
      if (line) document.execCommand('insertText', false, line)
    })
    emit()
  }

  return (
    <div>
      <div
        ref={ref}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyDown={onKeyDown}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onPaste={onPaste}
        onFocus={() => { focused.current = true }}
        onBlur={() => { focused.current = false; emit() }}
        data-placeholder="Start writing…  (type “- ” for a bullet, tap a heading’s ▸ to collapse)"
        style={{
          // 16px (not 15.5) so iOS doesn't zoom in when the editor is focused —
          // Safari auto-zooms any focused editable whose font-size is < 16px.
          minHeight: 300, outline: 'none', color: N.text,
          fontFamily: N.font, fontSize: 16, lineHeight: 1.6,
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${N.border}`,
          // 96px base clearance for the floating pill. No keyboard inset needed
          // any more: with the keyboard open the scroll container ends at the
          // keyboard top in BOTH modes (parent-resized iframe / data-kb lock).
          borderRadius: 12, padding: '14px 16px 96px',
          ['--na-link' as string]: noteA('ff'),
        } as React.CSSProperties}
      />

      {/* Floating formatting pill — pinned just above the keyboard (or bottom) */}
      <div
        ref={pillRef}
        onMouseDown={e => e.preventDefault()}   /* don't blur the editor when tapping the bar */
        style={{
          position: 'fixed',
          left: '50%',
          // Keyboard open:
          //  - embedded: the AIO parent has resized the iframe to end exactly at
          //    the keyboard top, so the pill just hugs the iframe bottom.
          //  - standalone: the document is locked (html[data-kb="1"]) so the
          //    layout viewport never scrolls; lift by the keyboard height.
          // Keyboard closed: sit just above the home indicator (env inset, or
          // the AIO-bridged --aio-safe-bottom inside the iframe).
          // NO transition — it must track keyboard/viewport changes instantly.
          bottom: kb > 60
            ? (embedded ? 8 : kb + 8)
            : 'calc(max(env(safe-area-inset-bottom), var(--aio-safe-bottom, 0px)) + 16px)',
          transform: 'translateX(-50%)',
          zIndex: 60,
          width: barOpen ? 'min(440px, calc(100vw - 12px))' : 'auto',
        }}
      >
        {barOpen ? (
          <div key="open" className="pill-pop" style={{
            display: 'flex', flexDirection: 'column', gap: 8, width: '100%',
            padding: '9px 12px',
            background: 'linear-gradient(180deg, rgba(34,34,40,0.97) 0%, rgba(16,16,20,0.98) 100%)',
            border: `1px solid ${N.borderHi}`, borderRadius: 22,
            backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 12px 38px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14)',
          }}>
            {/* Row 1 — block styles + break-out */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'stretch' }}>
              <Btn onClick={() => setBlock('H1')} title="Title"><span style={{ fontFamily: N.bebas, fontSize: 16 }}>Title</span></Btn>
              <Btn onClick={() => setBlock('H2')} title="Heading"><span style={{ fontWeight: 700, fontSize: 14 }}>Heading</span></Btn>
              <Btn onClick={() => setBlock('H3')} title="Subheading"><span style={{ fontWeight: 600, fontSize: 13 }}>Subhead</span></Btn>
              <Btn onClick={() => setBlock('P')} title="Body"><span style={{ fontSize: 13 }}>Body</span></Btn>
              <Btn onClick={detachBlock} title="Break out of heading group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18.84 12.25l1.72-1.71a4 4 0 0 0-5.66-5.66l-1.71 1.72M5.16 11.75l-1.72 1.71a4 4 0 0 0 5.66 5.66l1.71-1.72M8 2v3M2 8h3M16 22v-3M22 16h-3"/></svg>
              </Btn>
            </div>
            {/* Row 2 — inline formatting + hide */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'stretch' }}>
              <Btn onClick={() => exec('bold')} title="Bold"><b>B</b></Btn>
              <Btn onClick={() => exec('italic')} title="Italic"><i>I</i></Btn>
              <Btn onClick={() => exec('underline')} title="Underline"><u>U</u></Btn>
              <Btn onClick={() => exec('strikeThrough')} title="Strikethrough"><s>S</s></Btn>
              <Btn onClick={() => exec('insertUnorderedList')} title="Bullet list">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
              </Btn>
              <Btn onClick={() => exec('outdent')} title="Outdent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 6H8M21 12H12M21 18H8M6 9l-3 3 3 3"/></svg>
              </Btn>
              <Btn onClick={() => exec('indent')} title="Indent (sub-bullet)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 6H8M21 12h-9M21 18H8M3 9l3 3-3 3"/></svg>
              </Btn>
              <Btn onClick={addLink} title="Add link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
              </Btn>
              <Btn onClick={() => toggleBar(false)} title="Hide formatting bar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </Btn>
            </div>
          </div>
        ) : (
          <button
            key="closed"
            className="pill-pop"
            onMouseDown={e => e.preventDefault()}
            onClick={() => toggleBar(true)}
            title="Show formatting bar"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              padding: '10px 16px', borderRadius: 22,
              background: 'linear-gradient(180deg, rgba(34,34,40,0.96), rgba(16,16,20,0.97))',
              border: `1px solid ${N.borderHi}`, color: N.textSec,
              backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: '0 12px 38px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14)',
              fontFamily: N.font, fontSize: 14, fontWeight: 700,
            }}
          >
            <span style={{ fontFamily: N.bebas, fontSize: 18, lineHeight: 1 }}>Aa</span>
            <span style={{ fontSize: 12, color: N.textMut }}>Format</span>
          </button>
        )}
      </div>
    </div>
  )
}

function Btn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      title={title}
      onMouseDown={e => e.preventDefault()}   // keep the editor selection
      onClick={onClick}
      style={{
        minWidth: 30, height: 30, padding: '0 8px', cursor: 'pointer',
        background: 'rgba(255,255,255,0.05)', border: `1px solid ${N.border}`,
        borderRadius: 8, color: N.textSec, fontFamily: N.font,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

