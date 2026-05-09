import { useState } from 'react'
import { supabase } from '../lib/supabase/client'

interface Props {
  email?: string | null
}

export function UserMenu({ email }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOut() {
    setLoading(true)
    setError(null)
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) setError(signOutError.message)
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="userMenu">
      <span title={email ?? 'Signed in'}>{email ?? 'Signed in'}</span>
      <button type="button" className="secondary" onClick={() => void signOut()} disabled={loading}>
        {loading ? 'Signing out...' : 'Logout'}
      </button>
      {error && <small>{error}</small>}
    </div>
  )
}
