import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const hasDemoSession = cookieStore.has('demo_session');

    if (!session && !hasDemoSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Default Demo Info
    let user = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Teacher',
      role: 'teacher',
      is_onboarded: false,
      tenant_id: '00000000-0000-0000-0000-000000000001'
    };

    if (session) {
      const { data: profile, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profile) {
        user = profile;
      }
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Me API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
