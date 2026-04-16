import { NextRequest, NextResponse } from 'next/server';
import { mockTeachers } from '@/services/mockData';

export async function POST(req: NextRequest) {
  try {
    const { employeeId } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const teacher = mockTeachers.find(t => t.employee_id === employeeId.trim());

    if (!teacher) {
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 401 });
    }

    return NextResponse.json({ success: true, teacher });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
