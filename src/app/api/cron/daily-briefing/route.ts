import { NextRequest, NextResponse } from 'next/server';
import { sendDailyBriefingsToAllTeachers } from '@/bot/scheduler';

/**
 * Daily briefing cron endpoint
 * POST /api/cron/daily-briefing
 * 
 * This should be called by a cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * at 7:30 AM local time every day
 */
export async function POST(req: NextRequest) {
    try {
        // Verify the request is from authorized source — MANDATORY
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('CRON_SECRET environment variable is not configured');
            return NextResponse.json(
                { error: 'Server misconfiguration: cron secret not set' },
                { status: 500 }
            );
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log('Starting daily briefing cron job...');

        // Send daily briefings to all teachers
        const result = await sendDailyBriefingsToAllTeachers();

        if (result.success) {
            return NextResponse.json({
                message: 'Daily briefings sent successfully',
                ...result
            });
        } else {
            return NextResponse.json(
                {
                    message: 'Failed to send daily briefings',
                    error: result.error
                },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Error in daily briefing cron job:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Internal server error',
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint to check cron job status
 */
export async function GET() {
    return NextResponse.json({
        status: 'Daily briefing cron endpoint is active',
        schedule: '7:30 AM daily',
        timestamp: new Date().toISOString()
    });
}
