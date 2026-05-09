import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { AppData, Habit } from '../types'
import { makeHabit, sampleAppData } from './fixtures/appData'
import { loopZipFile } from './fixtures/zip'

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string, email: string } },
  sessionError: null as null | { message: string },
  sessionRejects: false,
  hookReturn: null as null | Record<string, unknown>,
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn()
}))

vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => {
        if (state.sessionRejects) throw new Error('Session unavailable')
        return { data: { session: state.session }, error: state.sessionError }
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: state.signInWithPassword,
      signUp: state.signUp,
      signInWithOtp: state.signInWithOtp,
      signOut: state.signOut
    }
  }
}))

vi.mock('../hooks/useSupabaseAppData', () => ({
  useSupabaseAppData: vi.fn(() => state.hookReturn)
}))

function signedInSession() {
  return {
    user: {
      id: 'user-1',
      email: 'reader@example.com'
    }
  }
}

function mockAppData(overrides: Partial<ReturnType<typeof baseHookReturn>> = {}) {
  const data = sampleAppData()
  const hook = {
    ...baseHookReturn(data),
    ...overrides
  }
  state.hookReturn = hook
  return hook
}

function baseHookReturn(data: AppData) {
  return {
    data,
    loading: false,
    error: null as string | null,
    refresh: vi.fn(async () => data),
    saveHabit: vi.fn(async (habit: Habit) => habit),
    deleteHabit: vi.fn(async () => undefined),
    upsertEntry: vi.fn(async (entry: unknown) => entry),
    deleteEntry: vi.fn(async () => undefined),
    upsertEntryContext: vi.fn(async (context: unknown) => context),
    deleteEntryContext: vi.fn(async () => undefined),
    importData: vi.fn(async () => data),
    exportableDataForUser: vi.fn(async () => data),
    clearError: vi.fn()
  }
}

describe('App UI flows', () => {
  beforeEach(() => {
    state.session = null
    state.sessionError = null
    state.sessionRejects = false
    state.hookReturn = null
    state.signInWithPassword.mockResolvedValue({ data: { session: signedInSession() }, error: null })
    state.signUp.mockResolvedValue({ data: { session: null }, error: null })
    state.signInWithOtp.mockResolvedValue({ data: {}, error: null })
    state.signOut.mockResolvedValue({ error: null })
  })

  it('shows the login screen when there is no session', async () => {
    render(<App />)

    expect(await screen.findByText('Sign in to sync habits and entries with Supabase.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows auth loading errors on the login screen', async () => {
    state.sessionError = { message: 'Auth service unavailable' }

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Auth service unavailable')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('submits login credentials and can request a magic link without secrets', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Email'), 'reader@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(state.signInWithPassword).toHaveBeenCalledWith({
      email: 'reader@example.com',
      password: 'password123'
    }))
    expect(await screen.findByText('Signed in.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Email magic link' }))

    expect(state.signInWithOtp).toHaveBeenCalledWith({
      email: 'reader@example.com',
      options: { emailRedirectTo: window.location.origin }
    })
  })

  it('shows the loading state for a signed-in session while habits load', async () => {
    state.session = signedInSession()
    mockAppData({ data: { habits: [], entries: [], entryContexts: [] }, loading: true })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Loading habits' })).toBeInTheDocument()
  })

  it('shows an empty state and opens the create form when there are no habits', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    mockAppData({ data: { habits: [], entries: [], entryContexts: [] } })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'No habits loaded' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('New habit')
  })

  it('shows a blocking load error and retries refresh', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData({
      data: { habits: [], entries: [], entryContexts: [] },
      loading: false,
      error: 'Could not load habits.'
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Error loading data' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(hook.refresh).toHaveBeenCalled()
  })

  it('loads habits for a signed-in session and signs out from the user menu', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    mockAppData()

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Read' })).toBeInTheDocument()
    expect(screen.getByText('reader@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(state.signOut).toHaveBeenCalled()
  })

  it('creates and edits a habit through the modal form', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData()

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.click(screen.getByRole('button', { name: 'New' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Meditate')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(hook.saveHabit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Meditate' })))
    expect(await screen.findByText('Habit saved.')).toBeInTheDocument()

    await user.click(screen.getByTitle('Edit'))
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Read nightly')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(hook.saveHabit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Read nightly' })))
  })

  it('surfaces habit save and delete errors from persistence', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData({
      saveHabit: vi.fn(async () => {
        throw new Error('Save failed')
      }),
      deleteHabit: vi.fn(async () => {
        throw new Error('Delete failed')
      })
    })
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.click(screen.getByRole('button', { name: 'New' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByTitle('Edit'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(hook.deleteHabit).toHaveBeenCalledWith('habit-read'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed')
  })

  it('deletes a habit after confirmation', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData()
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.click(screen.getByTitle('Edit'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(hook.deleteHabit).toHaveBeenCalledWith('habit-read'))
    expect(await screen.findByText('Habit deleted.')).toBeInTheDocument()
  })

  it('registers an entry from habit detail', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData()

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.clear(screen.getByLabelText('Entry date'))
    await user.type(screen.getByLabelText('Entry date'), '2026-05-08')
    await user.type(screen.getByLabelText('Notes'), 'Felt easy')
    await user.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => expect(hook.upsertEntry).toHaveBeenCalledWith(expect.objectContaining({
      habitId: 'habit-read',
      date: '2026-05-08',
      value: 'YES_MANUAL',
      notes: 'Felt easy'
    })))
    expect(hook.deleteEntryContext).toHaveBeenCalled()
  })

  it('toggles a calendar/list entry and reports persistence errors', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData({
      upsertEntry: vi.fn(async () => {
        throw new Error('Entry failed')
      })
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.click(screen.getAllByTitle('2026-05-08: no data')[0])

    await waitFor(() => expect(hook.upsertEntry).toHaveBeenCalled())
    expect(await screen.findByRole('alert')).toHaveTextContent('Entry failed')
  })

  it('toggles a calendar cell and opens the calendar edit hint', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData()
    vi.stubGlobal('alert', vi.fn())

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.click(screen.getAllByTitle('May 8, 2026: no data')[0])
    await waitFor(() => expect(hook.upsertEntry).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'EDIT' }))
    expect(globalThis.alert).toHaveBeenCalledWith('Tap any day to toggle its value. For numerical habits, it toggles between 0 and 1.')
  })

  it('saves optional context with an entry', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData()

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.clear(screen.getByLabelText('Entry date'))
    await user.type(screen.getByLabelText('Entry date'), '2026-05-08')
    await user.click(screen.getByText('Optional context'))
    await user.type(screen.getByLabelText('At what time?'), '07:45')
    await user.type(screen.getByLabelText('Where did you do it?'), 'Kitchen table')
    await user.type(screen.getByLabelText('Comment'), 'Quiet morning')
    await user.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => expect(hook.upsertEntryContext).toHaveBeenCalledWith(expect.objectContaining({
      habitId: 'habit-read',
      occurredAt: '2026-05-08T07:45:00',
      occurredTime: '07:45',
      locationText: 'Kitchen table',
      comment: 'Quiet morning'
    })))
  })

  it('opens habit detail when a habit row is selected', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const data = sampleAppData()
    const exercise = makeHabit({ id: 'habit-exercise', position: '003', name: 'Exercise', question: 'Did you exercise?' })
    mockAppData({ data: { ...data, habits: [...data.habits, exercise] } })

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.click(screen.getByText('Exercise'))

    expect(await screen.findByRole('heading', { name: 'Exercise' })).toBeInTheDocument()
    expect(screen.getAllByText('Did you exercise?')).toHaveLength(2)
  })

  it('imports a ZIP file through the hidden file input', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData()

    const { container } = render(<App />)
    await screen.findByRole('heading', { name: 'Read' })
    const input = container.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('File input was not rendered')

    const file = await loopZipFile()
    await user.upload(input, file)

    await waitFor(() => expect(hook.importData).toHaveBeenCalledWith(file, true))
    expect(await screen.findByText(/Imported 2 habits and 4 entries\./)).toBeInTheDocument()
  })

  it('imports in append mode and shows import errors', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData({
      importData: vi.fn(async () => {
        throw new Error('Bad ZIP')
      })
    })

    const { container } = render(<App />)
    await screen.findByRole('heading', { name: 'Read' })
    await user.click(screen.getByLabelText('Replace on import'))
    const input = container.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('File input was not rendered')

    const file = await loopZipFile()
    await user.upload(input, file)

    await waitFor(() => expect(hook.importData).toHaveBeenCalledWith(file, false))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad ZIP')
  })

  it('opens the export modal with Android-compatible options selected', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    mockAppData()

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })
    await user.click(screen.getByRole('button', { name: 'Export' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Export habits' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Export Android-compatible ZIP')).toBeChecked()
    expect(within(dialog).getByLabelText('Export Open Habits full backup')).not.toBeChecked()
  })

  it('exports Android-compatible and backup ZIPs from fresh data', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData()

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('button', { name: 'Current only' }))
    await user.click(screen.getByRole('button', { name: 'Export ZIP' }))

    await waitFor(() => expect(hook.exportableDataForUser).toHaveBeenCalled())
    expect(await screen.findByText('Android-compatible ZIP created from fresh Supabase data.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByLabelText('Export Open Habits full backup'))
    await user.click(screen.getByRole('button', { name: 'Export Backup' }))

    await waitFor(() => expect(hook.exportableDataForUser).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Open Habits full backup created from fresh Supabase data.')).toBeInTheDocument()
  })

  it('validates export selections and missing fresh habits', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData()

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })
    await user.click(screen.getByRole('button', { name: 'Export' }))

    const dialog = screen.getByRole('dialog')
    const checkboxes = within(dialog).getAllByRole('checkbox')
    for (const checkbox of checkboxes.slice(1)) {
      await user.click(checkbox)
    }
    await user.click(screen.getByRole('button', { name: 'Export ZIP' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Select at least one habit to export.')

    await user.click(within(dialog).getByRole('button', { name: 'All' }))
    hook.exportableDataForUser.mockResolvedValueOnce({ habits: [], entries: [], entryContexts: [] })
    await user.click(within(dialog).getByRole('button', { name: 'Export ZIP' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Selected habits are no longer available.')
  })

  it('surfaces export failures and clears notices', async () => {
    const user = userEvent.setup()
    state.session = signedInSession()
    const hook = mockAppData({
      exportableDataForUser: vi.fn(async () => {
        throw new Error('Export failed')
      })
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Read' })

    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('button', { name: 'Export ZIP' }))

    await waitFor(() => expect(hook.exportableDataForUser).toHaveBeenCalled())
    expect(await screen.findByRole('alert')).toHaveTextContent('Export failed')

    const closeButtons = screen.getAllByRole('button', { name: '×' })
    await user.click(closeButtons[0])
    expect(hook.clearError).toHaveBeenCalled()
  })
})
