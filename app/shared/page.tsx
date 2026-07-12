'use client'
// The standalone Shared page was removed -- shared notes now live on the Home
// page alongside owned notes, marked with a "Shared" tag (see app/page.tsx /
// NoteCard's isOwner prop). This route just redirects there in case anything
// still links to /shared (e.g. a bookmark or the AIO iframe's old nav state).
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SharedRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/') }, [router])
  return null
}
