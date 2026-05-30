import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import type { AuthUser, UserRole } from '@climence/shared';
import { UserRole as UserRoleEnum } from '@climence/shared';

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  iat: number;
  exp: number;
}

const TOKEN_HEADER = { alg: 'HS256', typ: 'JWT' } as const;
const TOKEN_TTL_SECONDS = 12 * 60 * 60;
const TOKEN_SECRET = process.env.JWT_SECRET ?? randomBytes(48).toString('base64url');

function encodeBase64Url(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function decodeBase64Url(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(data: string) {
  return createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
}

function safeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAuthToken(user: AuthUser) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS;

  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: issuedAt,
    exp: expiresAt,
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(TOKEN_HEADER));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(unsignedToken);
  const token = `${unsignedToken}.${signature}`;

  return {
    token,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function verifyAuthToken(token: string): AuthUser | null {
  const trimmedToken = token.trim();
  const parts = trimmedToken.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(unsignedToken);
  if (!safeEqualString(signature, expectedSignature)) return null;

  try {
    const header = JSON.parse(decodeBase64Url(encodedHeader)) as { alg?: string; typ?: string };
    if (header.alg !== TOKEN_HEADER.alg || header.typ !== TOKEN_HEADER.typ) return null;

    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<TokenPayload>;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    if (
      payload.role !== UserRoleEnum.ADMINISTRATOR &&
      payload.role !== UserRoleEnum.ANALYST &&
      payload.role !== UserRoleEnum.VIEWER
    ) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}
