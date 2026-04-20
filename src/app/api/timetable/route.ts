import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get('day'); // e.g. 'Mon'

    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    const hasDemoSession = cookieStore.has('demo_session');

    if (!session && !hasDemoSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Tenant Isolation
    let tenantId = '00000000-0000-0000-0000-000000000001';
    if (session) {
      const { data: profile } = await supabase.from('teachers').select('tenant_id').eq('id', session.user.id).single();
      if (profile) tenantId = profile.tenant_id;
    }

    // Fetch from 'periods' table
    let query = supabase
      .from('periods')
      .select(`
        *,
        classes (name),
        teachers (name)
      `)
      .eq('tenant_id', tenantId);

    // Map Day String to Number if needed, but schema uses day_of_week (int)
    const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    if (day) {
      query = query.eq('day_of_week', dayMap[day]);
    }

    const { data: periods, error } = await query;
    
    if (error) {
        console.warn('Supabase timetable fetch failed, falling back to mock data:', error);
        const { mockTimetable } = require('@/services/mockData');
        return NextResponse.json({ success: true, timetable: mockTimetable, isFallback: true });
    }

    // Format for UI
    const formattedTimetable = (periods || []).map(p => ({
      ...p,
      class_name: (p as any).classes?.name,
      teacher_name: (p as any).teachers?.name,
      day: day // Keep the requested day string for UI
    }));

    return NextResponse.json({ success: true, timetable: formattedTimetable });
  } catch (error: any) {
    console.error('Timetable API error, falling back to mock data:', error);
    try {
        const { mockTimetable } = require('@/services/mockData');
        return NextResponse.json({ success: true, timetable: mockTimetable, isFallback: true });
    } catch (fallbackError) {
        return NextResponse.json({ error: 'Failed to fetch timetable' }, { status: 500 });
    }
  }
}
