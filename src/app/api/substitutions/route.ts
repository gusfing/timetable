import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { findTopSubstitutes } from '@/lib/scheduler/engine';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/security/rate-limiter';

// GET - find substitutes for a teacher/period, or list all substitutions
export async function GET(req: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(`subs-get:${clientIp}`, RATE_LIMITS.substitutions);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const absentTeacherId = searchParams.get('absentTeacherId');
  const day = searchParams.get('day');
  const period = searchParams.get('period');

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Auth check
  const { data: { session } } = await supabase.auth.getSession();
  const hasDemoSession = cookieStore.has('demo_session');

  if (!session && !hasDemoSession) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let tenantId = '00000000-0000-0000-0000-000000000001';
  if (session) {
    // In a real app, we'd fetch the user's tenant_id here
    // For this route, the list view (lines 31-76) doesn't use tenantId yet, but logic engine (82+) might.
  }

  // List all recent substitutions if no specific teacher requested
  if (!absentTeacherId) {
    const { data: substitutions, error } = await supabase
      .from('substitution_requests')
      .select(`
        *,
        original_teacher:original_teacher_id(name),
        assigned_teacher:assigned_teacher_id(name),
        period:periods(
          id,
          subject,
          start_time,
          end_time,
          period_type,
          classes(name),
          rooms(name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching substitutions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to the shape expected by SubstitutionCard
    const mapped = (substitutions || []).map(s => ({
      id: s.id,
      originalTeacher: (s.original_teacher as any)?.name || 'Unknown',
      assignedTeacher: (s.assigned_teacher as any)?.name,
      status: s.status,
      expirationTime: s.expiration_time,
      fairnessRanking: s.fairness_ranking || [],
      period: {
        id: s.period.id,
        subject: s.period.subject,
        className: (s.period as any).classes?.name || 'Class',
        roomName: (s.period as any).rooms?.name || 'TBA',
        startTime: s.period.start_time.slice(0, 5),
        endTime: s.period.end_time.slice(0, 5),
        periodType: s.period.period_type,
      }
    }));

    return NextResponse.json(mapped);
  }

  if (!day || period === null) {
    return NextResponse.json({ error: 'day and period are required' }, { status: 400 });
  }

  // Fetch real teachers and timetable for logic engine
  const { data: allTeachers } = await supabase.from('teachers').select('*');
  const { data: allPeriods } = await supabase.from('periods').select('*, classes(name)');

  const absentTeacher = (allTeachers || []).find(t => t.id === absentTeacherId);
  if (!absentTeacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
  }

  // Map to TimetableEntry format for engine
  const mappedTT = (allPeriods || []).map(p => ({
    id: p.id,
    teacher_id: p.teacher_id,
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.day_of_week] as any,
    period_number: p.period_number,
    class_name: (p as any).classes?.name || 'Class',
    subject: p.subject,
    is_substitution: false,
    created_at: p.created_at
  }));

  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day || 'Mon');

  const substitutes = findTopSubstitutes(
    allTeachers || [],
    [absentTeacherId],
    absentTeacher.wing || 'Scholar', // Default fallback
    dayOfWeek,
    parseInt(period),
    mappedTT as any[]
  );

  return NextResponse.json({
    absentTeacher: { id: absentTeacher.id, name: absentTeacher.name, wing: absentTeacher.wing },
    substitutes: substitutes.map(t => ({
      id: t.id,
      name: t.name,
      wing: t.wing,
      workload_score: t.workload_score,
      telegram_id: t.telegram_user_id,
    })),
  });
}

// POST - assign a substitution
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const hasDemoSession = cookieStore.has('demo_session');

    if (!session && !hasDemoSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { absentTeacherId, substituteTeacherId, day, period } = body;

    if (!absentTeacherId || !substituteTeacherId || !day || period === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Identify tenant
    let tenantId = '00000000-0000-0000-0000-000000000001';
    let userId = '00000000-0000-0000-0000-000000000001';

    if (session) {
      const { data: profile } = await supabase.from('teachers').select('tenant_id').eq('id', session.user.id).single();
      if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      tenantId = profile.tenant_id;
      userId = session.user.id;
    }

    // 1. Find the period record to link to
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
    const { data: periodData } = await supabase
      .from('periods')
      .select('id')
      .eq('teacher_id', absentTeacherId)
      .eq('day_of_week', dayOfWeek)
      .eq('period_number', period)
      .single();

    if (!periodData) {
      return NextResponse.json({ error: 'Original period not found in database' }, { status: 404 });
    }

    // 2. Insert substitution request
    const { data: substitution, error } = await supabase
      .from('substitution_requests')
      .insert({
        tenant_id: tenantId,
        original_teacher_id: absentTeacherId,
        period_id: periodData.id,
        requested_by: userId,
        assigned_teacher_id: substituteTeacherId,
        status: 'assigned',
        expiration_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, substitution });
  } catch (error: any) {
    console.error('Substitution error:', error);
    return NextResponse.json({ error: error.message || 'Failed to assign substitution' }, { status: 500 });
  }
}

// Support for manual actions from the Marketplace
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    const { requestId, substituteTeacherId, action } = await req.json();

    if (action === 'manual_assign') {
      const { data: request, error } = await supabase
        .from('substitution_requests')
        .update({
          assigned_teacher_id: substituteTeacherId,
          status: 'assigned',
          updated_at: new Date().toISOString(),
          expiration_time: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        })
        .eq('id', requestId)
        .select(`
          *,
          assigned_teacher:assigned_teacher_id(name, telegram_user_id),
          period:periods(subject, period_number)
        `)
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, request });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
