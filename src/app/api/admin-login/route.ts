import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    if (!username || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Standard Supabase Sign In
    let authUser = null;
    let authError = null;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.trim(),
        password,
      });
      authUser = data.user;
      authError = error;
    } catch (e) {
      console.warn('Supabase Auth unreachable, checking demo fallback...');
    }

    // Demo Fallback for Testing
    if ((authError || !authUser) && username.trim() === 'admin@demo.school' && password === 'admin123') {
      const response = NextResponse.json({
        success: true,
        admin: { 
          id: '00000000-0000-0000-0000-000000000001',
          role: 'superadmin', 
          name: 'Demo SuperAdmin' 
        },
      });
      
      response.cookies.set('demo_session', 'true', { 
        path: '/', 
        maxAge: 60 * 60 * 24, // 24 hours
        httpOnly: false 
      });
      
      return response;
    }

    if (authError || !authUser) {
      return NextResponse.json({ error: authError?.message || 'Invalid credentials' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      admin: { 
        id: authUser.id,
        role: authUser.user_metadata?.role || 'admin', 
        name: authUser.user_metadata?.name || 'Super Admin' 
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
