import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LoginLockout } from './lockout';

const CONFIG = { maxFailures: 5, windowMs: 600_000, lockMs: 900_000 };
const EMAIL = 'analyst@mewa.gov.sa';

class FakeClock {
  constructor(private currentMs = 0) {}
  now = () => this.currentMs;
  advance(ms: number) {
    this.currentMs += ms;
  }
}

describe('LoginLockout', () => {
  it('does not lock before the threshold', () => {
    const clock = new FakeClock();
    const lockout = new LoginLockout(CONFIG, clock.now);

    for (let i = 0; i < 4; i += 1) {
      const status = lockout.recordFailure(EMAIL);
      assert.equal(status.locked, false, `fail #${i + 1} should not lock`);
      clock.advance(1000);
    }

    assert.equal(lockout.isLocked(EMAIL).locked, false);
  });

  it('locks for 15 minutes after the 5th failure inside the window', () => {
    const clock = new FakeClock();
    const lockout = new LoginLockout(CONFIG, clock.now);

    for (let i = 0; i < 4; i += 1) {
      lockout.recordFailure(EMAIL);
      clock.advance(1000);
    }

    const lockingFailure = lockout.recordFailure(EMAIL);
    assert.equal(lockingFailure.locked, true);
    assert.equal(lockingFailure.retryAfterSec, 900);

    const status = lockout.isLocked(EMAIL);
    assert.equal(status.locked, true);
    assert.ok(status.retryAfterSec > 0);
  });

  it('unlocks once the 15 minute window elapses', () => {
    const clock = new FakeClock();
    const lockout = new LoginLockout(CONFIG, clock.now);

    for (let i = 0; i < 5; i += 1) lockout.recordFailure(EMAIL);
    assert.equal(lockout.isLocked(EMAIL).locked, true);

    clock.advance(CONFIG.lockMs + 1);
    assert.equal(lockout.isLocked(EMAIL).locked, false);
  });

  it('does not lock when failures are spread outside the 10 minute window', () => {
    const clock = new FakeClock();
    const lockout = new LoginLockout(CONFIG, clock.now);

    // 4 failures, then jump past the window before the 5th.
    for (let i = 0; i < 4; i += 1) {
      lockout.recordFailure(EMAIL);
      clock.advance(60_000);
    }
    clock.advance(CONFIG.windowMs + 1);
    const status = lockout.recordFailure(EMAIL);
    assert.equal(status.locked, false);
  });

  it('successful login resets the failure counter', () => {
    const clock = new FakeClock();
    const lockout = new LoginLockout(CONFIG, clock.now);

    for (let i = 0; i < 4; i += 1) lockout.recordFailure(EMAIL);
    lockout.recordSuccess(EMAIL);

    const status = lockout.recordFailure(EMAIL);
    assert.equal(status.locked, false, 'fresh failure after success should not lock');
  });

  it('treats email case and surrounding whitespace as the same key', () => {
    const clock = new FakeClock();
    const lockout = new LoginLockout(CONFIG, clock.now);

    for (let i = 0; i < 5; i += 1) lockout.recordFailure(`  ${EMAIL.toUpperCase()}  `);
    assert.equal(lockout.isLocked(EMAIL).locked, true);
  });
});
