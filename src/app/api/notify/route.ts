import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { telegramId, teacherName, day, period, className, absentTeacherName } = await req.json();

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    if (!BOT_TOKEN) {
      console.warn('TELEGRAM_BOT_TOKEN not set - skipping notification');
      return NextResponse.json({ success: false, reason: 'Bot token not configured' });
    }

    if (!telegramId) {
      return NextResponse.json({ success: false, reason: 'No telegram ID' });
    }

    const message = `📢 *Substitution Assignment*\n\nHello ${teacherName},\n\nYou have been assigned a substitution:\n- *Day*: ${day}\n- *Period*: P${period + 1}\n- *Class*: ${className}\n- *Covering for*: ${absentTeacherName}\n\nPlease be on time. Thank you!`;

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      console.error('Telegram API error:', data);
      return NextResponse.json({ success: false, error: data.description });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notify error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
