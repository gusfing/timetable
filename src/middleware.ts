import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);
  
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Protect all /admin and /teacher routes
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin');
  const isTeacherPage = request.nextUrl.pathname.startsWith('/teacher');

  const hasDemoSession = request.cookies.has('demo_session');

  if ((isAdminPage || isTeacherPage) && !user && !hasDemoSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Role-based isolation
  if (user) {
    const { data: profile } = await supabase
      .from('teachers')
      .select('role')
      .eq('id', user.id)
      .single();

    if (isAdminPage && profile?.role !== 'admin' && profile?.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/teacher', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
