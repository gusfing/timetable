import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_RULES, TimetableRules } from '@/lib/scheduler/rules';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { session } } = await supabase.auth.getSession();
    const hasDemoSession = cookieStore.has('demo_session');
    
    if (!session && !hasDemoSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let tenantId = '00000000-0000-0000-0000-000000000001';

    if (session) {
      const { data: profile } = await supabase.from('teachers')
        .select('tenant_id')
        .eq('id', session.user.id)
        .single();
      if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      tenantId = profile.tenant_id;
    }

    // Try to fetch existing config
    const { data: config, error } = await supabase
      .from('tenant_configs')
      .select('rules')
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is 'no rows'
      console.error('Error fetching rules:', error);
      return NextResponse.json({ success: true, rules: DEFAULT_RULES });
    }

    return NextResponse.json({ 
      success: true, 
      rules: config?.rules || DEFAULT_RULES 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { session } } = await supabase.auth.getSession();
    const hasDemoSession = cookieStore.has('demo_session');
    
    if (!session && !hasDemoSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let tenantId = '00000000-0000-0000-0000-000000000001';
    let userId = '00000000-0000-0000-0000-000000000001';

    if (session) {
      const { data: profile } = await supabase.from('teachers')
        .select('tenant_id, role')
        .eq('id', session.user.id)
        .single();

      if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      tenantId = profile.tenant_id;
      userId = session.user.id;
    }

    const body = await req.json();
    
    // Upsert the config
    const { error } = await supabase
      .from('tenant_configs')
      .upsert({
        tenant_id: tenantId,
        rules: body,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id' });

    if (error) throw error;

    // Log the change
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      table_name: 'tenant_configs',
      record_id: tenantId, // We use tenant_id as record_id for configs
      action: 'UPDATE',
      new_data: body,
      changed_by: userId
    });

    return NextResponse.json({ success: true, rules: body });
  } catch (err: any) {
    console.error('Rules Save Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
