import { NextRequest, NextResponse } from 'next/server';
import { getNotifications, markAsRead, createNotification } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const teacherId = req.nextUrl.searchParams.get('teacherId') || undefined;
  return NextResponse.json({ success: true, notifications: getNotifications(teacherId) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const notification = createNotification(body);
    return NextResponse.json({ success: true, notification });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid data' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json();
    markAsRead(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid data' }, { status: 400 });
  }
}
