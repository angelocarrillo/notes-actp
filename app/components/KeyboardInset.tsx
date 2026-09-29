'use client'
import { useEffect } from 'react'

/**
 * Publishes how much of the screen the on-screen keyboard is covering as the
 * CSS variable `--kb-inset` on <html> (e.g. `312px`, or `0px` when closed).
 *
 * Why (iOS 27): anything `position: fixed; bottom: 0` is anchored to the
 * *layout* viewport, which does not shrink when the keyboard slides up. Up to
 * iOS 26 Safari papered over this by panning the page so a focused input in a
 * bottom-fixed bar (the search bar, the Share sheet) scrolled into view.
 * iOS 27 no longer does that pan, so those inputs stay hidden behind the number
 * pad until it is dismissed.
 *
 * Fix: measure the part of the layout viewport that sits below the *visual*
 * viewport (= what the keyboard covers) and let bottom-anchored UI lift itself
 * with `bottom: 'var(--kb-inset, 0px)'`. If Safari does still pan (older iOS),
 * the visual viewport's offsetTop absorbs it and the inset comes out ~0, so the
 * same code is correct on both old and new behaviour.
 *
 * Inside the AIO iframe the iframe's own visualViewport never sees the
 * keyboard (the AIO parent resizes the iframe instead), so this stays 0 there.
 */
const MIN_KEYBOARD_PX = 80   // ignore Safari toolbar wobble; a keyboard is 250px+

export default function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    let frame = 0
    let late = 0

    const measure = () => {
      const covered = window.innerHeight - (vv.height + vv.offsetTop)
      const inset = covered > MIN_KEYBOARD_PX ? Math.round(covered) : 0
      root.style.setProperty('--kb-inset', `${inset}px`)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    // focusout fires before the keyboard finishes animating away — re-measure
    // once it has settled so nothing stays lifted.
    const syncLate = () => {
      sync()
      window.clearTimeout(late)
      late = window.setTimeout(sync, 350)
    }

    measure()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', syncLate)
    document.addEventListener('focusin', syncLate)
    document.addEventListener('focusout', syncLate)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(late)
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', syncLate)
      document.removeEventListener('focusin', syncLate)
      document.removeEventListener('focusout', syncLate)
      root.style.removeProperty('--kb-inset')
    }
  }, [])

  return null
}
