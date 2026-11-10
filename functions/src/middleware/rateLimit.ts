import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { RequestError } from "./roleGate";

export type RateLimitPolicy = {
  limit: number;
  window: `${number} ${"s" | "m" | "h" | "d"}`;
};

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getLimiter(policy: RateLimitPolicy): Ratelimit {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new RequestError(503, "Rate limiting is not configured.");
  }

  redis ??= new Redis({ url, token });
  const key = `${policy.limit}:${policy.window}`;
  let limiter = limiters.get(key);

  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
      prefix: "quizmaster:rate-limit",
    });
    limiters.set(key, limiter);
  }

  return limiter;
}

export async function enforceRateLimit(
  subject: string,
  policy: RateLimitPolicy,
): Promise<void> {
  if (!subject.trim()) {
    throw new RequestError(400, "A rate-limit identity is required.");
  }

  try {
    const result = await getLimiter(policy).limit(subject);
    if (!result.success) {
      throw new RequestError(429, "Too many requests. Please try again later.");
    }
  } catch (error: unknown) {
    if (error instanceof RequestError) {
      throw error;
    }
    throw new RequestError(503, "Rate limiting is temporarily unavailable.");
  }
}