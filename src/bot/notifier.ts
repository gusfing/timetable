import { Bot, InlineKeyboard } from "grammy";
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) {
        console.warn('Supabase URL or Key missing');
        return null as any;
    }
    return createClient(url, key);
}

/**
 * Retry logic with exponential backoff
 */
async function executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    operationName = 'operation'
): Promise<{ success: boolean; result?: T; error?: Error }> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const result = await operation();
            if (attempt > 0) {
                console.log(`${operationName} succeeded on retry attempt ${attempt + 1}`);
            }
            return { success: true, result };
        } catch (error) {
            lastError = error as Error;
            
            // Don't retry on client errors (4xx)
            if (error && typeof error === 'object' && 'response' in error) {
                const response = (error as any).response;
                if (response?.status >= 400 && response?.status < 500) {
                    console.error(`${operationName} failed with client error (${response.status}), not retrying`);
                    return { success: false, error: lastError };
                }
            }
            
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`${operationName} attempt ${attempt + 1} failed, retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    // All retries failed, notify admin
    console.error(`${operationName} failed after ${maxRetries} retries:`, lastError);
    await notifyAdminOfSystemIssue(`${operationName} failed after ${maxRetries} retries: ${lastError?.message}`);
    
    return { success: false, error: lastError || new Error('Unknown error') };
}

/**
 * Format user-friendly error messages
 */
function formatErrorForUser(error: any): string {
    if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
        return 'The system is temporarily unavailable. We\'re working on it! 🔧';
    }
    
    if (error?.message?.includes('timeout')) {
        return 'The request took too long. Please try again in a moment. ⏱️';
    }
    
    if (error?.code === '23505') {
        return 'This time slot is already taken. Please choose another time. 📅';
    }
    
    if (error?.message?.includes('not found')) {
        return 'The requested information could not be found. Please contact admin. 🔍';
    }
    
    return 'Something went wrong. Our team has been notified and will fix it soon. 🛠️';
}

/**
 * Notify admin of system issues
 */
async function notifyAdminOfSystemIssue(message: string) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const supabase = getSupabase();
    try {
        const { data: admins } = await supabase
            .from('teachers')
            .select('telegram_user_id, name')
            .eq('role', 'admin')
            .not('telegram_user_id', 'is', null);

        if (!admins || admins.length === 0) return;

        const bot = new Bot(BOT_TOKEN || '');
        const alertMessage = `🚨 *System Alert*\n\n${message}\n\nTimestamp: ${new Date().toISOString()}`;

        for (const admin of admins) {
            try {
                await bot.api.sendMessage(admin.telegram_user_id, alertMessage, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error(`Failed to notify admin ${admin.name}:`, error);
            }
        }
    } catch (error) {
        console.error('Failed to notify admins of system issue:', error);
    }
}

/**
 * Notifies a teacher about a schedule change via Telegram with retry logic
 */
export async function notifyTeacherUpdate(
    telegramId: string,
    teacherName: string,
    data: {
        day: string;
        period: number;
        subject: string;
        class: string;
        action: "Substitution" | "Swap" | "Move";
    }
) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN || !telegramId) {
        console.warn(`Cannot send Telegram notification: Token or ID missing for ${teacherName}`);
        return { success: false, error: 'Missing credentials' };
    }

    const bot = new Bot(BOT_TOKEN);
    const message = `
📅 *Schedule Update for ${teacherName}*

The school admin has updated your timetable:
- *Action*: ${data.action}
- *Day*: ${data.day}
- *Period*: P${data.period}
- *Subject*: ${data.subject}
- *Class*: ${data.class}

Please check the app for full details.
    `.trim();

    const result = await executeWithRetry(
        () => bot.api.sendMessage(telegramId, message, { parse_mode: "Markdown" }),
        3,
        `Notification to ${teacherName}`
    );

    if (result.success) {
        console.log(`Telegram notification sent to ${teacherName} (${telegramId})`);
    } else {
        console.error(`Failed to send Telegram notification to ${telegramId}:`, result.error);
    }

    return result;
}

/**
 * Send substitution notification with interactive buttons
 */
export async function sendSubstitutionNotification(
    telegramUserId: string,
    request: {
        id: string;
        subject: string;
        className: string;
        roomName: string;
        startTime: string;
        endTime: string;
        originalTeacherName: string;
        reason?: string;
        fairnessIndex: number;
    }
) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN || !telegramUserId) {
        console.warn('Cannot send substitution notification: Missing credentials');
        return { success: false, error: 'Missing credentials' };
    }

    const bot = new Bot(BOT_TOKEN);
    
    const keyboard = new InlineKeyboard()
        .text('✅ Accept', JSON.stringify({ action: 'accept_substitution', requestId: request.id }))
        .text('❌ Decline', JSON.stringify({ action: 'decline_substitution', requestId: request.id }));

    const message = `
🔔 *Substitution Request*

📚 Subject: ${request.subject}
👥 Class: ${request.className}
🏫 Room: ${request.roomName}
⏰ Time: ${request.startTime} - ${request.endTime}
📊 Your Fairness Index: ${request.fairnessIndex}

Original teacher: ${request.originalTeacherName}
${request.reason ? `Reason: ${request.reason}` : ''}

⏳ Please respond within 10 minutes or it will be escalated to the next teacher.
    `.trim();

    const result = await executeWithRetry(
        () => bot.api.sendMessage(telegramUserId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        }),
        3,
        'Substitution notification'
    );

    if (result.success) {
        console.log(`Substitution notification sent to Telegram user ${telegramUserId}`);
    } else {
        console.error(`Failed to send substitution notification:`, result.error);
    }

    return result;
}

/**
 * Send daily briefing to a teacher
 */
export async function sendDailyBriefing(
    telegramUserId: string,
    teacherName: string,
    schedule: Array<{
        periodNumber: number;
        startTime: string;
        endTime: string;
        subject: string;
        className: string;
        roomName: string;
        periodType: string;
    }>
) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN || !telegramUserId) {
        console.warn(`Cannot send daily briefing: Missing credentials for ${teacherName}`);
        return { success: false, error: 'Missing credentials' };
    }

    const bot = new Bot(BOT_TOKEN);
    const date = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    let message: string;

    if (schedule.length === 0) {
        message = `📅 *${date}*\n\n✨ You have no scheduled periods today. Enjoy your free day!`;
    } else {
        const periods = schedule.map((p, i) => {
            const icon = p.periodType === 'teaching' ? '📚' : 
                         p.periodType === 'rest' ? '☕' :
                         p.periodType === 'break' ? '🍃' :
                         p.periodType === 'lunch' ? '🍱' : '📝';
            
            return `${i + 1}. ${p.startTime}-${p.endTime} ${icon} ${p.subject} | ${p.className} | Room ${p.roomName}`;
        }).join('\n');

        message = `📅 *${date}*\n\nYour schedule for today:\n\n${periods}\n\nHave a great day! 🎓`;
    }

    const result = await executeWithRetry(
        () => bot.api.sendMessage(telegramUserId, message, { parse_mode: 'Markdown' }),
        3,
        `Daily briefing for ${teacherName}`
    );

    if (result.success) {
        console.log(`Daily briefing sent to ${teacherName} (${telegramUserId})`);
    } else {
        console.error(`Failed to send daily briefing to ${teacherName}:`, result.error);
    }

    return result;
}

/**
 * Send batch notifications to multiple teachers
 */
export async function sendBatchNotifications(
    notifications: Array<{
        telegramUserId: string;
        message: string;
        parseMode?: 'Markdown' | 'HTML';
    }>
) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) {
        console.warn('Cannot send batch notifications: Missing bot token');
        return { success: false, error: 'Missing bot token' };
    }

    const bot = new Bot(BOT_TOKEN);
    const batchSize = 30; // Telegram rate limit: 30 messages/second
    const batches: typeof notifications[] = [];
    
    for (let i = 0; i < notifications.length; i += batchSize) {
        batches.push(notifications.slice(i, i + batchSize));
    }

    const results = [];
    
    for (const batch of batches) {
        const batchResults = await Promise.allSettled(
            batch.map(n => 
                bot.api.sendMessage(n.telegramUserId, n.message, { 
                    parse_mode: n.parseMode || 'Markdown' 
                })
            )
        );
        
        results.push(...batchResults);
        
        // Wait 1 second between batches to respect rate limits
        if (batches.indexOf(batch) < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Batch notifications: ${successCount} sent, ${failureCount} failed`);

    return {
        success: failureCount === 0,
        successCount,
        failureCount,
        results
    };
}

export { formatErrorForUser, executeWithRetry, notifyAdminOfSystemIssue };
