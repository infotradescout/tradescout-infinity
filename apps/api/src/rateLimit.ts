export class FixedWindowRateLimiter {
  readonly #buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  take(
    key: string,
    now = Date.now(),
  ): { allowed: boolean; retryAfterSeconds: number } {
    const current = this.#buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.#buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= this.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetAt - now) / 1000),
        ),
      };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
