# Seguridad de Supabase

Este repositorio puede ser publico, asi que los secretos deben quedarse fuera del codigo y fuera de Git.

## Variables de entorno

La publishable key de Supabase puede usarse en el frontend, pero debe configurarse en `.env.local`:

```env
VITE_SUPABASE_URL=https://tpehkqzwlbtdonizlody.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

`.env.local` no debe commitearse. Usa `.env.example` como plantilla sin valores secretos.

## Credenciales privadas

La Direct Connection String de Postgres no debe usarse en el frontend y no debe commitearse nunca. Tampoco deben commitearse contrasenas de base de datos, service role keys ni tokens privados.

Si una tarea necesita acceso administrativo o una connection string de Postgres, manten esos valores solo en un gestor de secretos o en variables de entorno locales fuera del repositorio.

## Supabase CLI

Para linkar el proyecto localmente:

```sh
supabase login
supabase init
supabase link --project-ref tpehkqzwlbtdonizlody
```

Las migraciones deben vivir en `supabase/migrations`.
