// API route for AI Commander

import { NextRequest, NextResponse } from 'next/server';
import { getAICommander } from '@/lib/ai-commander';

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    const { command } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { error: 'Command is required and must be a string' },
        { status: 400 }
      );
    }

    // For demo mode, use a mock admin user
    const storedUser = localStorage?.getItem('currentUser');
    if (!storedUser) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in first' },
        { status: 401 }
      );
    }

    const user = JSON.parse(storedUser);
    
    // Execute command
    const commander = getAICommander();
    const result = await commander.executeCommand(command, user.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI Command API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: `Server error: ${error.message}`,
        executionTime: 0,
      },
      { status: 500 }
    );
  }
}

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
}
