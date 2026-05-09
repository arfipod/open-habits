import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from '../components/AuthForm'
import { AuthGate } from '../components/AuthGate'
import { UserMenu } from '../components/UserMenu'

const authState = vi.hoisted(() => ({
  session: null as null | { user: { id: string, email: string } },
  getSessionError: null as null | { message: string },
  getSessionRejects: false,
  authCallback: null as null | ((_event: string, session: unknown) => void),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn()
}))

vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => {
        if (authState.getSessionRejects) throw new Error('Session crashed')
        return { data: { session: authState.session }, error: authState.getSessionError }
      }),
      onAuthStateChange: vi.fn((callback: (_event: string, session: unknown) => void) => {
        authState.authCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      signInWithPassword: authState.signInWithPassword,
      signUp: authState.signUp,
      signInWithOtp: authState.signInWithOtp,
      signOut: authState.signOut
    }
  }
}))

function session() {
  return { user: { id: 'user-1', email: 'reader@example.com' } }
}

describe('auth components', () => {
  beforeEach(() => {
    authState.session = null
    authState.getSessionError = null
    authState.getSessionRejects = false
    authState.authCallback = null
    authState.signInWithPassword.mockResolvedValue({ data: { session: session() }, error: null })
    authState.signUp.mockResolvedValue({ data: { session: null }, error: null })
    authState.signInWithOtp.mockResolvedValue({ data: {}, error: null })
    authState.signOut.mockResolvedValue({ error: null })
  })

  it('renders children when AuthGate receives a session', async () => {
    authState.session = session()

    render(<AuthGate>{activeSession => <p>Signed in as {activeSession.user.email}</p>}</AuthGate>)

    expect(await screen.findByText('Signed in as reader@example.com')).toBeInTheDocument()
  })

  it('shows session errors from AuthGate getSession result and rejection', async () => {
    authState.getSessionError = { message: 'Session failed' }
    const { unmount } = render(<AuthGate>{() => <p>Hidden</p>}</AuthGate>)

    expect(await screen.findByRole('alert')).toHaveTextContent('Session failed')
    unmount()

    authState.getSessionError = null
    authState.getSessionRejects = true
    render(<AuthGate>{() => <p>Hidden</p>}</AuthGate>)

    expect(await screen.findByRole('alert')).toHaveTextContent('Session crashed')
  })

  it('responds to AuthGate auth state changes', async () => {
    render(<AuthGate>{activeSession => <p>{activeSession.user.email}</p>}</AuthGate>)

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    await act(async () => {
      authState.authCallback?.('SIGNED_IN', session())
    })

    expect(await screen.findByText('reader@example.com')).toBeInTheDocument()
  })

  it('handles registration and auth errors in AuthForm', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)

    await user.click(screen.getByRole('tab', { name: 'Register' }))
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(authState.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'password123' })
    expect(await screen.findByText('Check your email to confirm the account, then sign in.')).toBeInTheDocument()

    authState.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: 'Bad credentials' } })
    await user.click(screen.getByRole('tab', { name: 'Login' }))
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Bad credentials')).toBeInTheDocument()
  })

  it('validates and reports magic link failures', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)

    await user.click(screen.getByRole('button', { name: 'Email magic link' }))
    expect(await screen.findByText('Enter your email first.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'reader@example.com')
    authState.signInWithOtp.mockResolvedValueOnce({ data: {}, error: { message: 'OTP failed' } })
    await user.click(screen.getByRole('button', { name: 'Email magic link' }))

    expect(await screen.findByText('OTP failed')).toBeInTheDocument()
  })

  it('reports UserMenu sign-out errors', async () => {
    const user = userEvent.setup()
    authState.signOut.mockResolvedValueOnce({ error: { message: 'Logout failed' } })

    render(<UserMenu email={null} />)

    expect(screen.getByText('Signed in')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(await screen.findByText('Logout failed')).toBeInTheDocument()

    authState.signOut.mockRejectedValueOnce(new Error('Network down'))
    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(await screen.findByText('Network down')).toBeInTheDocument()
  })
})
