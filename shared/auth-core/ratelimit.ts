/**
 * Best-effort in-memory sliding-window rate limiter.
 *
 * HONEST LIMITATION (per project specification): on Cloudflare Workers each
 * isolate has its own memory, so this limiter is NOT globally consistent —
 * different edge locations / isolates count independently, and isolates can
 * be evicted at any time. It still throttles burst login attempts against a
 * single edge location, which is the most common attack shape for a small
 * documentation site. For hard global limits, deploy Cloudflare WAF rate
 * limiting rules on POST /api/auth/login (documented in docs/AUTHENTICATION.md).
 *
 * On the self-hosted Node adapter the process is a single long-lived
 * interpreter, so the limiter is exact there.
 */
export interface RateLimitOptions {
  /** Maximum allowed events within the window. */
  readonly limit: number;
  /** Sliding window size in milliseconds. */
  readonly windowMs: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Milliseconds until a blocked caller may retry (0 when allowed). */
  readonly retryAfterMs: number;
  /** Remaining attempts in the current window. */
  readonly remaining: number;
}

interface Bucket {
  timestamps: number[];
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(options: RateLimitOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  /**
   * Records an event for `key` and reports whether it is allowed.
   * Callers that are blocked must NOT count the attempt as a failure.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const bucket = this.buckets.get(key) ?? { timestamps: [] };

    // Evict timestamps outside the sliding window.
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

    if (bucket.timestamps.length >= this.limit) {
      const oldest = bucket.timestamps[0]!;
      this.buckets.set(key, bucket);
      return {
        allowed: false,
        retryAfterMs: Math.max(1, oldest + this.windowMs - now),
        remaining: 0,
      };
    }

    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);
    return { allowed: true, retryAfterMs: 0, remaining: this.limit - bucket.timestamps.length };
  }

  /** Clears the window for a key (e.g. after a successful login). */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Periodic maintenance to keep memory bounded. */
  prune(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
      if (bucket.timestamps.length === 0) this.buckets.delete(key);
    }
  }
}

/**
 * Default login limiter policy: 5 attempts per 10 minutes per client IP.
 * Conservative enough for a shared-password site; failures only are counted
 * by the adapters (successful logins reset the bucket).
 */
export function createLoginRateLimiter(): RateLimiter {
  return new RateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });
}
