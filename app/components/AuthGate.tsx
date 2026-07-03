'use client'
import { useState, useEffect, createContext, useContext } from 'react'
import { signInWithPopup, signInWithCustomToken, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebase'

// Expose current user to children
export const UserContext = createContext<User | null>(null)
export const useUser = () => useContext(UserContext)

// Tokens
const T = {
  bg:      '#0a0a0c',
  surface: 'rgba(255,255,255,0.08)',
  border:  'rgba(255,255,255,0.10)',
  text:    '#f2f2f4',
  muted:   'rgba(255,255,255,0.40)',
  note:    '#8a7ad8',
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ display: 'block' }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

type Status = 'loading' | 'signed-in' | 'signed-out' | 'error'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus]       = useState<Status>('loading')
  const [user, setUser]           = useState<User | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!auth) return

    // If loaded inside the AIO iframe, a custom token is passed via ?token=
    // Use it to sign in silently so the user doesn't see a login prompt.
    const params = new URLSearchParams(window.location.search)
    const customToken = params.get('token')
    if (customToken) {
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      window.history.replaceState({}, '', url.toString())

      signInWithCustomToken(auth, customToken).catch(e => {
        console.error('Custom token sign-in failed:', e)
      })
    }

    return onAuthStateChanged(auth, u => {
      setUser(u)
      setStatus(u ? 'signed-in' : 'signed-out')
    })
  }, [])

  const handleGoogleSignIn = async () => {
    if (!auth) return
    setSigningIn(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      console.error('Sign-in error:', e)
      setStatus('error')
    } finally {
      setSigningIn(false)
    }
  }

  if (status === 'signed-in') {
    return <UserContext.Provider value={user}>{children}</UserContext.Provider>
  }

  if (status === 'loading') {
    return <div style={{ minHeight: '100dvh', background: T.bg }} />
  }

  return (
    <div style={{
      minHeight: '100dvh', background: T.bg,
      fontFamily: '"DM Sans", system-ui, sans-serif',
      color: T.text,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <p style={{ fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase', color: T.muted, margin: '0 0 16px' }}>
        Household Notes · 2026
      </p>
      <h1 style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: 'clamp(3rem, 14vw, 5.5rem)',
        lineHeight: 0.88, textAlign: 'center',
        letterSpacing: '0.06em', margin: '0 0 64px',
        color: T.note,
      }}>
        NOTES
      </h1>

      {status === 'error' && (
        <p style={{ fontSize: 13, color: '#f87171', margin: '0 0 12px' }}>Something went wrong. Try again.</p>
      )}

      <button onClick={handleGoogleSignIn} disabled={signingIn} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: signingIn ? T.surface : '#ffffff',
        color: signingIn ? T.muted : '#1a1a1a',
        border: `1.5px solid ${T.border}`,
        borderRadius: 12, padding: '13px 22px',
        fontSize: 14, fontWeight: 500,
        fontFamily: '"DM Sans", sans-serif',
        cursor: signingIn ? 'default' : 'pointer',
        opacity: signingIn ? 0.5 : 1,
      }}>
        {!signingIn && <GoogleIcon />}
        {signingIn ? 'Signing in…' : 'Sign in with Google'}
      </button>

      <p style={{ fontSize: 11, color: T.muted, margin: '16px 0 0', textAlign: 'center', maxWidth: 240 }}>
        Sign in once — you&apos;ll stay signed in automatically.
      </p>
    </div>
  )
}
