import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Admin Login] Missing Supabase environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Standard Supabase Sign In
    let authUser = null;
    let authError = null;

    try {
      // Try username as email first
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.trim().includes('@') ? username.trim() : `${username.trim()}@demo.school`,
        password,
      });
      authUser = data.user;
      authError = error;
    } catch (e) {
      console.warn('[Admin Login] Supabase Auth unreachable or failed:', e);
    }

    // Demo Fallback for Testing - Updated to match UI hints
    const demoCredentials = [
      { u: 'admin', p: 'admin123' },
      { u: 'admin@demo.school', p: 'admin123' },
      { u: 'principal', p: 'principal123' }
    ];

    const isDemo = demoCredentials.some(c => 
      username.trim().toLowerCase() === c.u.toLowerCase() && password === c.p
    );

    if ((authError || !authUser) && isDemo) {
      console.log(`[Admin Login] Falling back to demo session for user: ${username}`);
      const response = NextResponse.json({
        success: true,
        admin: { 
          id: '00000000-0000-0000-0000-000000000001',
          role: 'superadmin', 
          name: username.toLowerCase().includes('principal') ? 'Demo Principal' : 'Demo SuperAdmin' 
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
      console.warn(`[Admin Login] Failed login attempt for: ${username} - ${authError?.message || 'Invalid credentials'}`);
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
    console.error('[Admin Login] Unexpected error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
