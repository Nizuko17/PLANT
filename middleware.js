import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
              const expirationOptions = { ...options, maxAge: 60 * 60 * 24 * 30 }
              request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            const expirationOptions = { ...options, maxAge: 60 * 60 * 24 * 30 }
            supabaseResponse.cookies.set(name, value, expirationOptions)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Rotte protette
  if (
    !user &&
    (request.nextUrl.pathname.startsWith('/account/profilo') ||
     request.nextUrl.pathname.startsWith('/ordini') ||
     request.nextUrl.pathname.startsWith('/preferiti') ||
     request.nextUrl.pathname.startsWith('/admin'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/account'
    return NextResponse.redirect(url)
  }

  // Blocco guest rotte
  if (
    user && 
    (request.nextUrl.pathname === '/account' || request.nextUrl.pathname === '/account/reset-password')
  ) {
      const url = request.nextUrl.clone()
      url.pathname = '/account/profilo'
      return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
