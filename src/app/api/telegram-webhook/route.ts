import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/bot/webhook';

/**
 * Telegram webhook endpoint
 * POST /api/telegram-webhook
 */
export async function POST(req: NextRequest) {
    try {
        // Verify the request is from Telegram — MANDATORY
        const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (!secretToken) {
            console.error('TELEGRAM_WEBHOOK_SECRET environment variable is not configured');
            return NextResponse.json(
                { error: 'Server misconfiguration: webhook secret not set' },
                { status: 500 }
            );
        }

        const providedToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (providedToken !== secretToken) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get the update from Telegram
        const update = await req.json();

        // Process the update using grammY's webhook handler
        const response = await handleWebhook(req as any);

        return new NextResponse(response.body, {
            status: response.status,
            headers: response.headers as any
        });

    } catch (error) {
        console.error('Error processing Telegram webhook:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint to check webhook status
 */
export async function GET() {
    return NextResponse.json({
        status: 'Telegram webhook endpoint is active',
        timestamp: new Date().toISOString()
    });
}
