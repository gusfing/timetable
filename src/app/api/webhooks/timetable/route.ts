import { NextResponse } from "next/server";
import { notifyTeacherUpdate } from "@/bot/notifier";
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

/**
 * Webhook handler for timetable updates.
 * Triggered by Supabase or an admin action.
 */
export async function POST(req: Request) {
    try {
        const { teacher_id, day, period_number, class_id, action } = await req.json();

        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const { data: teacher } = await (supabase.from('teachers') as any)
            .select('id, name, telegram_user_id')
            .eq('id', teacher_id)
            .single();

        if (teacher && teacher.telegram_user_id) {
            await notifyTeacherUpdate(teacher.telegram_user_id, teacher.name, {
                day,
                period: period_number,
                subject: class_id,
                class: class_id,
                action: action || "Move",
            });
            return NextResponse.json({ success: true, message: "Notification sent" });
        }

        return NextResponse.json({
            success: false,
            message: "Teacher not found or no Telegram ID linked"
        });
    } catch (error) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
    }
}
