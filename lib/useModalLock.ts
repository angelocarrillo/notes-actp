'use client'
import { useEffect } from 'react'

// Ref-counted body[data-modal] flag. The BottomNav hides itself while any
// sheet/modal is open. Reference-counting means nested sheets keep the nav
// hidden until the LAST one closes.
let count = 0

export function useModalLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    count += 1
    document.body.setAttribute('data-modal', 'true')
    return () => {
      count -= 1
      if (count <= 0) {
        count = 0
        document.body.removeAttribute('data-modal')
      }
    }
  }, [active])
}
