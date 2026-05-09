import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase/client'
import { AuthForm } from './AuthForm'

interface Props {
  children: (session: Session) => ReactNode
}

export function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!mounted) return
        if (sessionError) setError(sessionError.message)
        setSession(data.session)
      })
      .catch(sessionError => {
        if (!mounted) return
        setError(sessionError instanceof Error ? sessionError.message : 'Could not load session.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setLoading(false)
      setError(null)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <main className="authShell">
        <section className="authCard compactStatus">
          <h1>Open Habits</h1>
          <p>Loading session...</p>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <>
        {error && <div className="toast error" role="alert">{error}</div>}
        <AuthForm />
      </>
    )
  }

  return <>{children(session)}</>
}
