import { Router, type Request, type Response } from 'express';
import { authenticateUser } from '../features/auth/users';
import { createAuthToken } from '../features/auth/token';
import { loginLockout } from '../features/auth/lockout';
import { getPermissionsForUser } from '../features/auth/permissions';
import { validateLoginInput } from '../features/auth/validation';
import { requireAuth } from '../lib/auth';
import {
  sendBadRequest,
  sendTooManyRequests,
  sendUnauthorized,
} from '../lib/http';

const router = Router();

router.post('/login', (req, res) => {
  const validation = validateLoginInput(req.body);
  if (!validation.ok) {
    sendBadRequest(res, validation.error);
    return;
  }

  const email = validation.payload.email;

  // Reject early if the account is currently locked — independent of whether
  // the password would have been correct, so an attacker can't probe during
  // the lockout window.
  const lockStatus = loginLockout.isLocked(email);
  if (lockStatus.locked) {
    sendTooManyRequests(
      res,
      'Account temporarily locked. Try again later.',
      lockStatus.retryAfterSec,
    );
    return;
  }

  const user = authenticateUser(email, validation.payload.password);
  if (!user) {
    const updated = loginLockout.recordFailure(email);
    if (updated.locked) {
      sendTooManyRequests(
        res,
        'Account temporarily locked. Try again later.',
        updated.retryAfterSec,
      );
      return;
    }
    sendUnauthorized(res, 'Incorrect email or password.');
    return;
  }

  loginLockout.recordSuccess(email);
  const { token, expiresAt } = createAuthToken(user);
  res.status(200).json({
    token,
    user,
    expiresAt,
  });
});

export function getCurrentUser(req: Request, res: Response) {
  const user = req.authUser;
  if (!user) {
    sendUnauthorized(res, 'Authentication required.');
    return;
  }

  res.status(200).json({
    user,
    permissions: getPermissionsForUser(user),
  });
}

router.get('/me', requireAuth, getCurrentUser);

// Stateless JWT today: nothing to revoke server-side. The endpoint exists so
// the dashboard has a clean call to make and so we have a place to add token
// revocation when we move beyond pure JWT.
router.post('/logout', requireAuth, (_req, res) => {
  res.status(204).send();
});

export default router;
