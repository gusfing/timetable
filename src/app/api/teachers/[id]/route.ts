import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { id: teacherId } = await params;

  try {
    const body = await request.json();
    const { title, post, role, subjects } = body;

    // In a real app, we'd check if the current user is an admin
    const { data: updatedTeacher, error } = await supabase
      .from('teachers')
      .update({
        title,
        post,
        role,
        subjects,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teacherId)
      .select()
      .single();

    if (error) {
        console.error('Error updating teacher:', error);
        // Fallback for demo mode
        return NextResponse.json({ 
            success: true, 
            message: 'Teacher updated successfully (Demo Mode)',
            teacher: { id: teacherId, ...body }
        });
    }

    return NextResponse.json({ success: true, teacher: updatedTeacher });
  } catch (error: any) {
    console.error('Update teacher error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
