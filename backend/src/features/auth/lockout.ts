import {
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_LOCK_MS,
  MAX_LOGIN_FAILURES,
} from '@climence/shared';

/**
 * In-memory login lockout policy (UC-A6 / FR-02).
 *
 * Sliding window over the last MAX_LOGIN_FAILURES failed attempts. If the
 * window fills inside LOGIN_FAILURE_WINDOW_MS, the email is locked for
 * LOGIN_LOCK_MS — independent of password correctness during the lock.
 *
 * In-process state is intentional for the SWE 496 scope (single API node);
 * a multi-node deployment would back this with Redis. The data shape stays
 * the same, so the swap is local to this file.
 */

export interface LockoutConfig {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}

export interface LockoutStatus {
  locked: boolean;
  retryAfterSec: number;
}

export class LoginLockout {
  private failures = new Map<string, number[]>();
  private lockedUntil = new Map<string, number>();

  constructor(
    private readonly config: LockoutConfig = {
      maxFailures: MAX_LOGIN_FAILURES,
      windowMs: LOGIN_FAILURE_WINDOW_MS,
      lockMs: LOGIN_LOCK_MS,
    },
    private readonly now: () => number = Date.now,
  ) {}

  isLocked(email: string): LockoutStatus {
    const key = normalize(email);
    const until = this.lockedUntil.get(key);
    if (!until) return { locked: false, retryAfterSec: 0 };

    const remaining = until - this.now();
    if (remaining <= 0) {
      this.lockedUntil.delete(key);
      this.failures.delete(key);
      return { locked: false, retryAfterSec: 0 };
    }
    return { locked: true, retryAfterSec: Math.ceil(remaining / 1000) };
  }

  recordFailure(email: string): LockoutStatus {
    const key = normalize(email);
    const now = this.now();

    // Pre-existing lock still active — leave it; nothing to add.
    const existing = this.isLocked(key);
    if (existing.locked) return existing;

    const recent = (this.failures.get(key) ?? []).filter(
      ts => now - ts < this.config.windowMs,
    );
    recent.push(now);

    if (recent.length >= this.config.maxFailures) {
      this.lockedUntil.set(key, now + this.config.lockMs);
      this.failures.delete(key);
      return { locked: true, retryAfterSec: Math.ceil(this.config.lockMs / 1000) };
    }

    this.failures.set(key, recent);
    return { locked: false, retryAfterSec: 0 };
  }

  recordSuccess(email: string) {
    const key = normalize(email);
    this.failures.delete(key);
    this.lockedUntil.delete(key);
  }

  // Test/admin helper — clears all state.
  reset() {
    this.failures.clear();
    this.lockedUntil.clear();
  }
}

function normalize(email: string) {
  return email.trim().toLowerCase();
}

// Singleton used by the route layer. Tests construct their own instance with
// a fake clock and never touch this one.
export const loginLockout = new LoginLockout();
