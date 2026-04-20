import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    const hasDemoSession = cookieStore.has('demo_session');

    if (!session && !hasDemoSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Tenant Isolation
    let tenantId = '00000000-0000-0000-0000-000000000001';
    if (session) {
      const { data: profile } = await supabase
        .from('teachers')
        .select('tenant_id')
        .eq('id', session.user.id)
        .single();
      if (profile) tenantId = profile.tenant_id;
    }

    const { data: teachers, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
        console.warn('Supabase fetch failed, falling back to mock data:', error);
        const { mockTeachers } = require('@/services/mockData');
        return NextResponse.json({ success: true, teachers: mockTeachers, isFallback: true });
    }

    return NextResponse.json({ success: true, teachers: teachers || [] });
  } catch (error: any) {
    console.error('Error in teachers API, falling back to mock data:', error);
    try {
        const { mockTeachers } = require('@/services/mockData');
        return NextResponse.json({ success: true, teachers: mockTeachers, isFallback: true });
    } catch (fallbackError) {
        return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: 500 });
    }
  }
}
