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
    const hidden = stack.length > 0
    el.style.display = hidden ? 'none' : ''
    if (lvl > 0 && !hidden && el.dataset.collapsed === 'true') stack.push(lvl)
  }
}

export function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref     = useRef<HTMLDivElement | null>(null)
  const focused = useRef(false)

  // Floating formatting pill: open/tucked-away state (persisted) + keyboard inset.
  const [barOpen, setBarOpen] = useState(true)
  const [kbInset, setKbInset] = useState(0)

  useEffect(() => {
    try { const s = localStorage.getItem('notes_fmtbar_open'); if (s === '0') setBarOpen(false) } catch { /* ignore */ }
  }, [])
  const toggleBar = (open: boolean) => {
    setBarOpen(open)
    try { localStorage.setItem('notes_fmtbar_open', open ? '1' : '0') } catch { /* ignore */ }
  }

  // Keep the pill above the on-screen keyboard using the VisualViewport API.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onVV = () => setKbInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', onVV)
    vv.addEventListener('scroll', onVV)
    onVV()
    return () => { vv.removeEventListener('resize', onVV); vv.removeEventListener('scroll', onVV) }
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
          minHeight: 300, outline: 'none', color: N.text,
          fontFamily: N.font, fontSize: 15.5, lineHeight: 1.6,
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${N.border}`,
          borderRadius: 12, padding: '14px 16px 96px',
          ['--na-link' as string]: noteA('ff'),
        } as React.CSSProperties}
      />

      {/* Floating formatting pill — sits at the bottom, rides above the keyboard */}
      <div
        onMouseDown={e => e.preventDefault()}   /* don't blur the editor when tapping the bar */
        style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: kbInset > 0 ? kbInset + 10 : 'calc(env(safe-area-inset-bottom) + 14px)',
          zIndex: 60, maxWidth: 'calc(100vw - 20px)',
          transition: 'bottom 0.18s ease',
        }}
      >
        {barOpen ? (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
            padding: '8px 10px',
            background: 'linear-gradient(180deg, rgba(34,34,40,0.96) 0%, rgba(16,16,20,0.97) 100%)',
            border: `1px solid ${N.borderHi}`, borderRadius: 20,
            backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 10px 34px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              <Btn onClick={() => setBlock('H1')} title="Title"><span style={{ fontFamily: N.bebas, fontSize: 17 }}>Title</span></Btn>
              <Btn onClick={() => setBlock('H2')} title="Heading"><span style={{ fontWeight: 700, fontSize: 15 }}>Heading</span></Btn>
              <Btn onClick={() => setBlock('H3')} title="Subheading"><span style={{ fontWeight: 600, fontSize: 13 }}>Subhead</span></Btn>
              <Btn onClick={() => setBlock('P')} title="Body"><span style={{ fontSize: 13 }}>Body</span></Btn>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', alignItems: 'stretch' }}>
              <Btn onClick={() => exec('bold')} title="Bold"><b>B</b></Btn>
              <Btn onClick={() => exec('italic')} title="Italic"><i>I</i></Btn>
              <Btn onClick={() => exec('underline')} title="Underline"><u>U</u></Btn>
              <Btn onClick={() => exec('strikeThrough')} title="Strikethrough"><s>S</s></Btn>
              <Sep />
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
              <Sep />
              <Btn onClick={() => toggleBar(false)} title="Hide formatting bar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </Btn>
            </div>
          </div>
        ) : (
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => toggleBar(true)}
            title="Show formatting bar"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              padding: '10px 16px', borderRadius: 22,
              background: 'linear-gradient(180deg, rgba(34,34,40,0.96), rgba(16,16,20,0.97))',
              border: `1px solid ${N.borderHi}`, color: N.textSec,
              backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: '0 10px 34px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
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

function Sep() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: N.border, margin: '2px 2px' }} />
}
