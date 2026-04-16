import { NextRequest, NextResponse } from 'next/server';
import { mockTeachers, mockTimetable } from '@/services/mockData';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get('teacherId');
    const day = searchParams.get('day');

    let timetable = [...mockTimetable];
    
    // Filter by teacher if provided
    if (teacherId) {
      timetable = timetable.filter(e => e.teacher_id === teacherId);
    }
    
    // Filter by day if provided
    if (day) {
      timetable = timetable.filter(e => e.day === day);
    }
    
    timetable.sort((a, b) => {
      // Sort by teacher first, then period
      if (a.teacher_id !== b.teacher_id) {
        return a.teacher_id.localeCompare(b.teacher_id);
      }
      return a.period_number - b.period_number;
    });

    return NextResponse.json({ success: true, timetable });
  } catch (error) {
    console.error('Timetable error:', error);
    return NextResponse.json({ error: 'Failed to fetch timetable' }, { status: 500 });
  }
}
