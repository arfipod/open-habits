# Security

Open Habits handles personal habit data. Treat habit names, entries, notes, locations, comments, and context as private user data.

## Environment Variables

The frontend may use only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Example `.env.local`:

```env
VITE_SUPABASE_URL=https://tpehkqzwlbtdonizlody.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

The project URL is public. The publishable key belongs in `.env.local`; docs should use a placeholder, not a real value.

## Secrets

Never commit real secrets.

Do not commit:

- `.env`
- `.env.local`
- Supabase Direct Connection String
- Postgres passwords
- service role keys
- personal access tokens
- private deployment tokens

The Supabase Direct Connection String is only for local CLI usage, private migration tooling, or secure deployment workflows. It must never appear in frontend code, tests, documentation, committed files, or generated artifacts.

If a secret is pasted into the repository, remove it immediately and rotate it in the provider dashboard.

## Supabase

Use Supabase Auth and RLS as the security boundary.

Required RLS pattern for user-owned tables:

```sql
user_id = auth.uid()
```

Required RLS pattern for profiles:

```sql
id = auth.uid()
```

Do not disable RLS for convenience. Do not use a service role key from frontend code.

## Local Storage

`localStorage` may store harmless UI preferences only.

Allowed examples:

- selected habit id
- last selected period
- UI display options
- theme preference

Do not store:

- full app data
- Supabase credentials
- habit entries
- private context comments
- location text

## Import and Export Privacy

Android-compatible Loop exports must exclude Open Habits-only context:

- `locationText`
- `occurredAt`
- `occurredTime`
- context comments
- Supabase user ids
- import batch metadata
- private application state

Open Habits full backups may include context and should be treated as private user data.

## Documentation

Documentation may contain public project references such as:

```text
https://tpehkqzwlbtdonizlody.supabase.co
```

Documentation must not contain real secret values.
