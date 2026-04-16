import { NextResponse } from 'next/server';
import { mockTeachers } from '@/services/mockData';

export async function GET() {
  try {
    return NextResponse.json({ success: true, teachers: mockTeachers });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: 500 });
  }
}
