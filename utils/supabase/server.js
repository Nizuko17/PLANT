import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Impostiamo la scadenza a 30 giorni come richiesto dall'utente
              const expirationOptions = { ...options, maxAge: 60 * 60 * 24 * 30 }
              cookieStore.set(name, value, expirationOptions)
            })
          } catch {
            // Se chiamato in un Server Component silenzia l'errore (il middleware gestirà i cookie HTTP)
          }
        },
      },
    }
  )
}
