import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 401 });
    }

    // 3. Sign in via Supabase Auth
    const email = teacher.employee_id === 'EMP1' ? 'teacher1@demo.school' : `${teacher.employee_id.toLowerCase()}@demo.school`;
    
    const { data: { session }, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password: 'password123',
    });

    if (authErr) {
       return NextResponse.json({ error: authErr.message }, { status: 401 });
    }

    return NextResponse.json({ success: true, teacher });
  } catch (err: any) {
    console.error('Teacher login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
