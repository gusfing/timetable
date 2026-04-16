/**
 * Simple in-memory rate limiter for API routes.
 * 
 * For production at scale, replace with Upstash Redis or Vercel KV.
 * This implementation is sufficient for single-instance deployments
 * and provides basic protection against brute-force and spam.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}, 60_000);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * Check rate limit for a given identifier (e.g., IP address or user ID).
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetTime) {
    // First request or window expired — start new window
    store.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetInMs: config.windowMs,
    };
  }

  // Window is still active
  entry.count += 1;

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: entry.resetTime - now,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetInMs: entry.resetTime - now,
  };
}

/**
 * Extract client IP from request headers (works with Vercel, Cloudflare, etc.)
 */
export function getClientIp(req: Request): string {
  const forwarded = (req.headers as any).get?.('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = (req.headers as any).get?.('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

// Pre-configured limiters for common use cases
export const RATE_LIMITS = {
  /** Auth endpoints: 5 attempts per minute per IP */
  auth: { maxRequests: 5, windowMs: 60_000 } as RateLimitConfig,
  /** AI command: 10 requests per minute per IP */
  aiCommand: { maxRequests: 10, windowMs: 60_000 } as RateLimitConfig,
  /** General API: 60 requests per minute per IP */
  general: { maxRequests: 60, windowMs: 60_000 } as RateLimitConfig,
  /** Substitutions: 30 requests per minute per IP */
  substitutions: { maxRequests: 30, windowMs: 60_000 } as RateLimitConfig,
} as const;
