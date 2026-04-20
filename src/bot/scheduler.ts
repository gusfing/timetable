import { createClient } from '@supabase/supabase-js';
import { sendDailyBriefing } from './notifier';

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) {
        throw new Error('Supabase URL or Key missing');
    }
    return createClient(url, key);
}

/**
 * Send daily briefings to all linked teachers
 * This should be called by a cron job at 7:30 AM local time
 */
export async function sendDailyBriefingsToAllTeachers() {
    console.log('Starting daily briefing delivery...');
    
    const supabase = getSupabase();
    try {
        // Get all teachers with linked Telegram accounts
        const { data: teachers, error: teachersError } = await supabase
            .from('teachers')
            .select('id, name, telegram_user_id')
            .not('telegram_user_id', 'is', null);

        if (teachersError) {
            console.error('Error fetching teachers:', teachersError);
            return { success: false, error: teachersError };
        }

        if (!teachers || teachers.length === 0) {
            console.log('No teachers with linked Telegram accounts found');
            return { success: true, count: 0 };
        }

        console.log(`Found ${teachers.length} teachers with linked accounts`);

        // Get today's day of week
        const today = new Date();
        const dayOfWeek = today.getDay();

        const results = [];

        // Send briefing to each teacher
        for (const teacher of teachers) {
            try {
                // Fetch teacher's schedule for today
                const { data: periods, error: periodsError } = await supabase
                    .from('periods')
                    .select(`
                        period_number,
                        start_time,
                        end_time,
                        subject,
                        period_type,
                        classes (name),
                        rooms (name)
                    `)
                    .eq('teacher_id', teacher.id)
                    .eq('day_of_week', dayOfWeek)
                    .order('period_number');

                if (periodsError) {
                    console.error(`Error fetching schedule for ${teacher.name}:`, periodsError);
                    results.push({ teacher: teacher.name, success: false, error: periodsError });
                    continue;
                }

                // Format schedule for briefing
                const schedule = (periods || []).map(p => ({
                    periodNumber: p.period_number,
                    startTime: p.start_time.slice(0, 5),
                    endTime: p.end_time.slice(0, 5),
                    subject: p.subject,
                    className: (p as any).classes?.name || 'Unknown',
                    roomName: (p as any).rooms?.name || 'TBA',
                    periodType: p.period_type
                }));

                // Send briefing
                const result = await sendDailyBriefing(
                    teacher.telegram_user_id,
                    teacher.name,
                    schedule
                );

                results.push({ 
                    teacher: teacher.name, 
                    success: result.success,
                    periodsCount: schedule.length
                });

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                console.error(`Error sending briefing to ${teacher.name}:`, error);
                results.push({ teacher: teacher.name, success: false, error });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        console.log(`Daily briefing delivery complete: ${successCount} sent, ${failureCount} failed`);

        return {
            success: true,
            totalTeachers: teachers.length,
            successCount,
            failureCount,
            results
        };

    } catch (error) {
        console.error('Error in daily briefing delivery:', error);
        return { success: false, error };
    }
}

/**
 * Check for expired substitution requests and escalate them
 * This should be called periodically (e.g., every minute)
 */
export async function checkExpiredSubstitutionRequests() {
    const supabase = getSupabase();
    try {
        const now = new Date().toISOString();

        // Find expired pending/assigned requests
        const { data: expiredRequests, error } = await supabase
            .from('substitution_requests')
            .select('*')
            .in('status', ['pending', 'assigned'])
            .lt('expiration_time', now);

        if (error) {
            console.error('Error fetching expired requests:', error);
            return { success: false, error };
        }

        if (!expiredRequests || expiredRequests.length === 0) {
            return { success: true, expiredCount: 0 };
        }

        console.log(`Found ${expiredRequests.length} expired substitution requests`);

        // Mark them as expired
        const { error: updateError } = await supabase
            .from('substitution_requests')
            .update({ status: 'expired', updated_at: now })
            .in('id', expiredRequests.map(r => r.id));

        if (updateError) {
            console.error('Error updating expired requests:', updateError);
            return { success: false, error: updateError };
        }

        console.log(`Marked ${expiredRequests.length} requests as expired`);

        return {
            success: true,
            expiredCount: expiredRequests.length,
            requests: expiredRequests
        };

    } catch (error) {
        console.error('Error checking expired requests:', error);
        return { success: false, error };
    }
}

/**
 * Setup cron jobs for scheduled tasks
 * This would typically be called in a separate worker process or serverless function
 */
export function setupScheduledTasks() {
    // Daily briefing at 7:30 AM
    // In production, this would be handled by a cron service like Vercel Cron or AWS EventBridge
    console.log('Scheduled tasks setup (configure external cron service for production)');
    
    // Example: Check expired requests every minute
    // setInterval(checkExpiredSubstitutionRequests, 60000);
    
    // Example: Send daily briefings at 7:30 AM
    // This would be configured in vercel.json or similar
}

export default {
    sendDailyBriefingsToAllTeachers,
    checkExpiredSubstitutionRequests,
    setupScheduledTasks
};
