import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  return { supabase, response: supabaseResponse }
}

export async function updateSession(request: NextRequest) {
  const { supabase, response: supabaseResponse } = createClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPathAdmin = request.nextUrl.pathname.startsWith('/admin')
  const isPathTeacher = request.nextUrl.pathname.startsWith('/teacher')

  if (isPathAdmin || isPathTeacher) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectedFrom', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
    
    // RBAC logic here
    const role = user.user_metadata?.role
    if (isPathAdmin && role !== 'admin' && role !== 'superadmin') {
      const url = request.nextUrl.clone()
      url.pathname = '/teacher/profile'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
