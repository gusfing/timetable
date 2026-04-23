import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  console.log('[Login API] POST request received');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Login API] Missing Supabase environment variables');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { employeeId } = await req.json();
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    // 1. Try to Look up teacher in DB
    let teacher = null;
    let teacherErr = null;

    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*, tenants(name)')
        .eq('employee_id', employeeId.trim())
        .single();
      teacher = data;
      teacherErr = error;
    } catch (e) {
      console.warn('DB unreachable, checking demo fallback for teacher...');
    }

    // 2. Demo Fallback for Testing
    if ((teacherErr || !teacher) && employeeId.trim() === 'EMP1') {
      const response = NextResponse.json({ 
        success: true, 
        teacher: { 
          id: '00000000-0000-0000-0000-000000000002', 
          name: 'Demo Teacher One',
          employee_id: 'EMP1',
          role: 'teacher'
        } 
      });
      
      response.cookies.set('demo_session', 'true', { 
        path: '/', 
        maxAge: 60 * 60 * 24, 
        httpOnly: false 
      });
      
      return response;
    }

    if (teacherErr || !teacher) {
      console.warn(`[Teacher Login] Invalid Employee ID attempt: ${employeeId}`);
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 401 });
    }

    // 3. Sign in via Supabase Auth
    const email = teacher.employee_id === 'EMP1' ? 'teacher1@demo.school' : `${teacher.employee_id.toLowerCase()}@demo.school`;
    
    const { data: { session }, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password: 'password123',
    });

    if (authErr) {
       console.error(`[Teacher Login] Auth error for ${email}:`, authErr.message);
       return NextResponse.json({ error: authErr.message }, { status: 401 });
    }

    console.log(`[Teacher Login] Successful login for: ${teacher.name} (${employeeId})`);
    return NextResponse.json({ success: true, teacher });
  } catch (err: any) {
    console.error('[Teacher Login] Unexpected error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
