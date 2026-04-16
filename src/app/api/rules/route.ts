import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_RULES, TimetableRules } from '@/lib/scheduler/rules';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('teachers')
      .select('tenant_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Try to fetch existing config
    const { data: config, error } = await supabase
      .from('tenant_configs')
      .select('rules')
      .eq('tenant_id', profile.tenant_id)
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
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('teachers')
      .select('tenant_id, role')
      .eq('id', session.user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    
    // Upsert the config
    const { error } = await supabase
      .from('tenant_configs')
      .upsert({
        tenant_id: profile.tenant_id,
        rules: body,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id' });

    if (error) throw error;

    // Log the change
    await supabase.from('audit_logs').insert({
      tenant_id: profile.tenant_id,
      table_name: 'tenant_configs',
      record_id: profile.tenant_id, // We use tenant_id as record_id for configs
      action: 'UPDATE',
      new_data: body,
      changed_by: session.user.id
    });

    return NextResponse.json({ success: true, rules: body });
  } catch (err: any) {
    console.error('Rules Save Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
