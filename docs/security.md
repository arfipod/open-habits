# Supabase Security

This repository may be public, so secrets must stay out of the codebase and out of Git.

## Environment Variables

The Supabase publishable key can be used in the frontend, but it must be configured in `.env.local`:

```env
VITE_SUPABASE_URL=https://tpehkqzwlbtdonizlody.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Do not commit `.env.local`. Use `.env.example` as a template without secret values.

## Private Credentials

The Postgres Direct Connection String must not be used in the frontend and must never be committed. Database passwords, service role keys, and private tokens must never be committed either.

If a task requires administrative access or a Postgres connection string, keep those values only in a secret manager or in local environment variables outside the repository.

## Supabase CLI

To link the project locally, use the Supabase CLI through `npx`:

```sh
npx --yes supabase@latest login
npx --yes supabase@latest init
npx --yes supabase@latest link --project-ref tpehkqzwlbtdonizlody
```

Migrations must live in `supabase/migrations`.
