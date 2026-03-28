import { eds } from "@eds-fw/framework";

const RATELIMIT_TIMEOUT = 10_000; //10 sec

const makeTimeout = async () => {
  await eds.wait(RATELIMIT_TIMEOUT);
  throw new RateLimitError();
}

/**
 * @throws {RateLimitError} if rate limited
 */
export function rateLimitSafe<T>(promise: Promise<T>): Promise<T | Awaited<T>> {
  return Promise.race([ promise, makeTimeout() ]);
}

export class RateLimitError extends Error {}
