import { Bot, InlineKeyboard, Context } from 'grammy';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { DEFAULT_RULES } from '../lib/scheduler/rules';
import { findTopSubstitutes } from '../lib/scheduler/engine';

const token = process.env.TELEGRAM_BOT_TOKEN || '';

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) {
        throw new Error('Supabase URL or Key missing');
    }
    return createClient(url, key);
}

// Lazy load bot
let _bot: Bot | null = null;
export function getBot() {
    if (!_bot) {
        if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');
        _bot = new Bot(token);
    }
    return _bot;
}

// Store conversation state for Employee ID verification
const conversationState = new Map<number, { awaitingEmployeeId: boolean }>();

// Command: /start
getBot().command('start', (ctx) => {
    ctx.reply(
        'Welcome to Anti-Gravity Timetable! 🎓\n\n' +
        'Use /link to connect your account with your Employee ID.\n' +
        'Use /today to see today\'s schedule.\n' +
        'Use /week to see your weekly schedule.',
        { parse_mode: 'Markdown' }
    );
});

// Command: /link - Start Employee ID verification flow
getBot().command('link', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Check if already linked
    const { data: existingTeacher } = await getSupabase()
        .from('teachers')
        .select('name, employee_id')
        .eq('telegram_user_id', userId.toString())
        .single();

    if (existingTeacher) {
        return ctx.reply(
            `✅ Your account is already linked!\n\n` +
            `Name: ${existingTeacher.name}\n` +
            `Employee ID: ${existingTeacher.employee_id}\n\n` +
            `Use /today to see your schedule.`
        );
    }

    conversationState.set(userId, { awaitingEmployeeId: true });
    await ctx.reply(
        '🔐 *Account Linking*\n\n' +
        'Please enter your Employee ID to link your Telegram account.\n\n' +
        'Example: EMP001',
        { parse_mode: 'Markdown' }
    );
});

// Command: /today - Get today's schedule
getBot().command('today', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
        const schedule = await getDailySchedule(userId.toString());
        await ctx.reply(schedule, { parse_mode: 'Markdown' });
    } catch (error) {
        await ctx.reply(
            '❌ Unable to fetch your schedule. Please make sure your account is linked using /link.',
            { parse_mode: 'Markdown' }
        );
    }
});

// Command: /week - Get weekly schedule
getBot().command('week', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
        const schedule = await getWeeklySchedule(userId.toString());
        await ctx.reply(schedule, { parse_mode: 'Markdown' });
    } catch (error) {
        await ctx.reply(
            '❌ Unable to fetch your schedule. Please make sure your account is linked using /link.',
            { parse_mode: 'Markdown' }
        );
    }
});

// Handle callback queries for substitution buttons
getBot().on('callback_query:data', async (ctx) => {
    try {
        const data = JSON.parse(ctx.callbackQuery.data);
        
        if (data.action === 'accept_substitution') {
            await handleSubstitutionAccept(ctx, data.requestId);
        } else if (data.action === 'decline_substitution') {
            await handleSubstitutionDecline(ctx, data.requestId);
        }
        
        await ctx.answerCallbackQuery();
    } catch (error) {
        console.error('Error handling callback query:', error);
        await ctx.answerCallbackQuery({ text: 'An error occurred. Please try again.' });
    }
});

// Handle text messages for Employee ID verification
getBot().on('message:text', async (ctx) => {
    const userId = ctx.from?.id;
    const text = ctx.message.text;
    
    if (!userId) return;

    const state = conversationState.get(userId);
    
    if (state?.awaitingEmployeeId) {
        await handleEmployeeIdVerification(ctx, text, userId);
        conversationState.delete(userId);
    }
});

// Helper: Handle Employee ID verification
async function handleEmployeeIdVerification(ctx: Context, employeeId: string, telegramUserId: number) {
    try {
        // Validate Employee ID format
        if (!employeeId || employeeId.length < 3) {
            return ctx.reply('❌ Invalid Employee ID format. Please try again with /link.');
        }

        // Check if Employee ID exists in database
        const { data: teacher, error } = await getSupabase()
            .from('teachers')
            .select('id, name, telegram_user_id')
            .eq('employee_id', employeeId)
            .single();

        if (error || !teacher) {
            // Log failed attempt
            console.warn(`Failed Employee ID verification attempt: ${employeeId} by Telegram user ${telegramUserId}`);
            
            return ctx.reply(
                '❌ Invalid Employee ID. Please check your ID and try again.\n\n' +
                'If you continue to have issues, please contact the school administrator.',
                { parse_mode: 'Markdown' }
            );
        }

        // Check if this Employee ID is already linked to another Telegram account
        if (teacher.telegram_user_id && teacher.telegram_user_id !== telegramUserId.toString()) {
            return ctx.reply(
                '❌ This Employee ID is already linked to another Telegram account.\n\n' +
                'Please contact the school administrator if this is an error.',
                { parse_mode: 'Markdown' }
            );
        }

        // Link Telegram account
        const { error: updateError } = await getSupabase()
            .from('teachers')
            .update({
                telegram_user_id: telegramUserId.toString(),
                telegram_linked_at: new Date().toISOString()
            })
            .eq('id', teacher.id);

        if (updateError) {
            console.error('Error linking Telegram account:', updateError);
            return ctx.reply('❌ An error occurred while linking your account. Please try again later.');
        }

        await ctx.reply(
            `✅ *Account Successfully Linked!*\n\n` +
            `Welcome, ${teacher.name}!\n\n` +
            `You will now receive:\n` +
            `• Daily schedule briefings at 7:30 AM\n` +
            `• Real-time timetable updates\n` +
            `• Substitution requests with Accept/Decline buttons\n\n` +
            `Use /today to see your schedule for today.`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error in Employee ID verification:', error);
        await ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
}

// Helper: Get daily schedule
async function getDailySchedule(telegramUserId: string): Promise<string> {
    // Get teacher info
    const { data: teacher, error: teacherError } = await getSupabase()
        .from('teachers')
        .select('id, name')
        .eq('telegram_user_id', telegramUserId)
        .single();

    if (teacherError || !teacher) {
        throw new Error('Teacher not found');
    }

    // Get today's day of week (0 = Sunday, 6 = Saturday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dateStr = today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    // Fetch today's periods
    const { data: periods, error: periodsError } = await getSupabase()
        .from('periods')
        .select(`
            *,
            classes (name),
            rooms (name)
        `)
        .eq('teacher_id', teacher.id)
        .eq('day_of_week', dayOfWeek)
        .order('period_number');

    if (periodsError) {
        throw new Error('Error fetching schedule');
    }

    if (!periods || periods.length === 0) {
        return `📅 *${dateStr}*\n\n✨ You have no scheduled periods today. Enjoy your free day!`;
    }

    const periodsList = periods.map((p, i) => {
        const icon = p.period_type === 'teaching' ? '📚' : 
                     p.period_type === 'rest' ? '☕' :
                     p.period_type === 'break' ? '🍃' :
                     p.period_type === 'lunch' ? '🍱' : '📝';
        
        return `${i + 1}. ${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)} ${icon} ${p.subject} | ${p.classes.name} | Room ${p.rooms?.name || 'TBA'}`;
    }).join('\n');

    return `📅 *${dateStr}*\n\nYour schedule for today:\n\n${periodsList}\n\nHave a great day! 🎓`;
}

// Helper: Get weekly schedule
async function getWeeklySchedule(telegramUserId: string): Promise<string> {
    const { data: teacher, error: teacherError } = await getSupabase()
        .from('teachers')
        .select('id, name')
        .eq('telegram_user_id', telegramUserId)
        .single();

    if (teacherError || !teacher) {
        throw new Error('Teacher not found');
    }

    const { data: periods, error: periodsError } = await getSupabase()
        .from('periods')
        .select(`
            *,
            classes (name),
            rooms (name)
        `)
        .eq('teacher_id', teacher.id)
        .order('day_of_week, period_number');

    if (periodsError) {
        throw new Error('Error fetching schedule');
    }

    if (!periods || periods.length === 0) {
        return '📅 *Weekly Schedule*\n\n✨ You have no scheduled periods this week.';
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const scheduleByDay = periods.reduce((acc, p) => {
        if (!acc[p.day_of_week]) acc[p.day_of_week] = [];
        acc[p.day_of_week].push(p);
        return acc;
    }, {} as Record<number, typeof periods>);

    let message = '📅 *Weekly Schedule*\n\n';
    
    for (const [day, dayPeriods] of Object.entries(scheduleByDay)) {
        message += `*${dayNames[parseInt(day)]}*\n`;
        (dayPeriods as any[]).forEach((p) => {
            const icon = p.period_type === 'teaching' ? '📚' : '☕';
            message += `  ${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)} ${icon} ${p.subject} | ${p.classes.name}\n`;
        });
        message += '\n';
    }

    return message;
}

// Helper: Handle substitution acceptance
async function handleSubstitutionAccept(ctx: Context, requestId: string) {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
        // Get teacher info
        const { data: teacher } = await getSupabase()
            .from('teachers')
            .select('id, name')
            .eq('telegram_user_id', userId.toString())
            .single();

        if (!teacher) {
            return ctx.editMessageText('❌ Unable to verify your account. Please contact admin.');
        }

        // Update substitution request
        const { data: request, error } = await getSupabase()
            .from('substitution_requests')
            .update({ 
                status: 'accepted',
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('assigned_teacher_id', teacher.id)
            .select(`
                *,
                periods (
                    subject,
                    start_time,
                    end_time,
                    classes (name),
                    rooms (name)
                )
            `)
            .single();

        if (error || !request) {
            return ctx.editMessageText('❌ Unable to accept substitution. It may have been assigned to someone else.');
        }

        await ctx.editMessageText(
            `✅ *Substitution Accepted!*\n\n` +
            `You have accepted the substitution for:\n` +
            `📚 ${request.periods.subject}\n` +
            `👥 ${request.periods.classes.name}\n` +
            `⏰ ${request.periods.start_time.slice(0, 5)} - ${request.periods.end_time.slice(0, 5)}\n` +
            `🏫 Room ${request.periods.rooms?.name || 'TBA'}\n\n` +
            `Thank you for your flexibility!`,
            { parse_mode: 'Markdown' }
        );

        // Notify admin
        await notifyAdminOfSubstitutionStatus(request, 'accepted', teacher.name);
    } catch (error) {
        console.error('Error accepting substitution:', error);
        await ctx.editMessageText('❌ An error occurred. Please try again or contact admin.');
    }
}

// Helper: Handle substitution decline
async function handleSubstitutionDecline(ctx: Context, requestId: string) {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
        const { data: teacher } = await getSupabase()
            .from('teachers')
            .select('id, name')
            .eq('telegram_user_id', userId.toString())
            .single();

        if (!teacher) {
            return ctx.editMessageText('❌ Unable to verify your account. Please contact admin.');
        }

        // Update substitution request to declined
        const { data: request, error } = await getSupabase()
            .from('substitution_requests')
            .update({ 
                status: 'declined',
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('assigned_teacher_id', teacher.id)
            .select()
            .single();

        if (error || !request) {
            return ctx.editMessageText('❌ Unable to decline substitution. It may have been assigned to someone else.');
        }

        await ctx.editMessageText(
            `📝 *Substitution Declined*\n\n` +
            `You have declined this substitution request.\n` +
            `The system will notify the next available teacher.`,
            { parse_mode: 'Markdown' }
        );

        // Notify admin and escalate to next candidate
        await notifyAdminOfSubstitutionStatus(request, 'declined', teacher.name);
        await escalateToNextCandidate(request);
    } catch (error) {
        console.error('Error declining substitution:', error);
        await ctx.editMessageText('❌ An error occurred. Please try again or contact admin.');
    }
}

// Helper: Notify admin of substitution status
async function notifyAdminOfSubstitutionStatus(request: any, status: string, teacherName: string) {
    // Get admin users
    const { data: admins } = await getSupabase()
        .from('teachers')
        .select('telegram_user_id, name')
        .eq('role', 'admin')
        .not('telegram_user_id', 'is', null);

    if (!admins || admins.length === 0) return;

    const icon = status === 'accepted' ? '✅' : '❌';
    const message = `${icon} *Substitution ${status.toUpperCase()}*\n\n` +
        `Teacher: ${teacherName}\n` +
        `Request ID: ${request.id.slice(0, 8)}...\n` +
        `Status: ${status}`;

    for (const admin of admins) {
        try {
            await getBot().api.sendMessage(admin.telegram_user_id, message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error(`Failed to notify admin ${admin.name}:`, error);
        }
    }
}

// Helper: Escalate to next candidate
async function escalateToNextCandidate(request: any) {
    try {
        console.log(`Escalating substitution request ${request.id} for period ${request.period_id}`);
        
        // 1. Get the original period details
        const { data: period } = await getSupabase()
            .from('periods')
            .select('*, teachers(wing, tenant_id)')
            .eq('id', request.period_id)
            .single();

        if (!period) return;
        const tenantId = (period.teachers as any).tenant_id;

        // 2. Fetch rules for this tenant
        const { data: config } = await getSupabase()
            .from('tenant_configs')
            .select('rules')
            .eq('tenant_id', tenantId)
            .single();
        
        const rules = config?.rules || DEFAULT_RULES;

        // 3. Fetch all teachers and current timetable to find new candidates
        const { data: allTeachers } = await getSupabase().from('teachers').select('*').eq('tenant_id', tenantId);
        const { data: allPeriods } = await getSupabase().from('periods').select('*, classes(name)').eq('tenant_id', tenantId);
        
        // 4. Mark previously involved teachers as unavailable
        const { data: previousAttempts } = await getSupabase()
            .from('substitution_requests')
            .select('assigned_teacher_id')
            .eq('period_id', request.period_id);
        
        const unavailableIds = [
            request.original_teacher_id,
            ...previousAttempts?.map(pa => pa.assigned_teacher_id).filter(id => id !== null) || []
        ];

        // 5. Use the engine to find the next best
        // Map periods to the shape expected by the engine
        const dayOfWeekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const mappedTT = (allPeriods || []).map(p => ({
            id: p.id,
            teacher_id: p.teacher_id,
            day: dayOfWeekNames[p.day_of_week] as any,
            day_of_week: p.day_of_week,
            period_number: p.period_number,
            class_name: (p as any).classes?.name || 'Class',
            subject: p.subject,
            period_type: p.period_type,
            is_substitution: false,
        }));

        const candidates = findTopSubstitutes(
            allTeachers || [],
            unavailableIds as string[],
            (period.teachers as any).wing || 'Scholar',
            period.day_of_week,
            period.period_number,
            mappedTT as any[],
            rules as any,
            1 // We just need the next one
        );

        if (candidates.length === 0) {
            console.log('No more eligible substitutes found.');
            // Optional: notify admin that no one is left
            return;
        }

        const nextSubstitute = candidates[0];

        // 6. Create new request
        const { data: newRequest } = await getSupabase()
            .from('substitution_requests')
            .insert({
                tenant_id: tenantId,
                original_teacher_id: request.original_teacher_id,
                period_id: request.period_id,
                requested_by: request.requested_by,
                assigned_teacher_id: nextSubstitute.id,
                status: 'assigned',
                expiration_time: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            })
            .select()
            .single();

        if (newRequest && nextSubstitute.telegram_user_id) {
            // 7. Notify the new teacher
            const message = `🔄 *Urgent Substitution Request*\n\n` +
                `Hi ${nextSubstitute.name}, you are the next best substitute for:\n` +
                `📚 ${period.subject}\n` +
                `👥 Period ${period.period_number}\n\n` +
                `Would you like to accept?`;
            
            const keyboard = new InlineKeyboard()
                .text('✅ Accept', JSON.stringify({ action: 'accept_substitution', requestId: newRequest.id }))
                .text('❌ Decline', JSON.stringify({ action: 'decline_substitution', requestId: newRequest.id }));

            await getBot().api.sendMessage(nextSubstitute.telegram_user_id, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }

    } catch (error) {
        console.error('Escalation error:', error);
    }
}

// Export helper functions for use in edge functions
export { getDailySchedule, getWeeklySchedule };
