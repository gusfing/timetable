import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint to check for expired substitution requests
 * 
 * This endpoint is called every 5 minutes by Vercel Cron to:
 * 1. Find requests that haven't been responded to within 10 minutes
 * 2. Escalate to the next candidate in the fairness ranking
 * 3. Mark requests as expired when no candidates remain
 * 4. Notify admins of expired requests
 * 
 * Schedule: Every 5 minutes
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret — MANDATORY, never bypassed
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
    
    // Call the edge function
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-expired-requests`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Edge function error:', error);
      return NextResponse.json(
        { error: 'Edge function failed', details: error },
        { status: 500 }
      );
    }
    
    const result = await response.json();
    
    console.log('Expired requests check completed:', result);
    
    return NextResponse.json({
      success: true,
      ...result,
    });
    
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Allow GET for testing
export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Cron endpoint is active',
    schedule: 'Every 5 minutes (*/5 * * * *)',
    endpoint: '/api/cron/check-expired',
  });
}
