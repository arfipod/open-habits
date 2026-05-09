import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase/client'

type Mode = 'login' | 'register'

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      const credentials = { email: email.trim(), password }
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials)

      if (result.error) {
        setError(result.error.message)
      } else if (mode === 'register' && !result.data.session) {
        setMessage('Check your email to confirm the account, then sign in.')
      } else {
        setMessage(mode === 'login' ? 'Signed in.' : 'Account created.')
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  async function sendMagicLink() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Enter your email first.')
      return
    }

    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: window.location.origin
        }
      })

      if (otpError) setError(otpError.message)
      else setMessage('Magic link sent. Check your email.')
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not send magic link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="authShell">
      <section className="authCard">
        <div className="authBrand">
          <h1>Open Habits</h1>
          <p>Sign in to sync habits and entries with Supabase.</p>
        </div>

        <div className="authTabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form className="authForm" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>

          {error && <p className="formMessage error">{error}</p>}
          {message && <p className="formMessage">{message}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <button type="button" className="secondary" onClick={() => void sendMagicLink()} disabled={loading}>
            Email magic link
          </button>
        </form>
      </section>
    </main>
  )
}
