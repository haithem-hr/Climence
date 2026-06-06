
import type { AuthUser } from '@climence/shared';
import { UserRole } from '@climence/shared';
import bcrypt from './bcrypt-mock.js';
import { getPostgresPool, migratePostgres } from '../../storage/redisPostgres/clients.js';
import { logger } from '../../lib/logger.js';

interface DbUserRow {
  user_id: number;
  username: string;
  password_hash: string;
  role: string;
}

const SEED_USERS = [
  { username: 'admin@mewa.gov.sa', password: 'Admin123!', role: UserRole.ADMINISTRATOR },
  { username: 'analyst@mewa.gov.sa', password: 'Analyst123!', role: UserRole.ANALYST },
  { username: 'viewer@mewa.gov.sa', password: 'Viewer123!', role: UserRole.VIEWER },
];

// ── SQLite mode: in-memory user store ────────────────────────────────────────
const isSqlite = () => (process.env.CLIMENCE_STORAGE ?? 'sqlite') === 'sqlite';

interface MemUser { username: string; passwordHash: string; role: UserRole }
const memUsers: MemUser[] = [];

async function initMemUsers() {
  if (memUsers.length > 0) return;
  for (const u of SEED_USERS) {
    memUsers.push({ username: u.username, passwordHash: await bcrypt.hash(u.password, 10), role: u.role });
  }
}

// ── Postgres pool (only created when NOT in SQLite mode) ─────────────────────
let pool: ReturnType<typeof getPostgresPool> | null = null;
function getPool() {
  if (!pool) pool = getPostgresPool();
  return pool;
}

function nameFromUsername(username: string) {
  const local = username.split('@')[0] ?? username;
  const words = local.split(/[._-]/g).filter(Boolean);
  if (words.length === 0) return username;
  return words.map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function initAuthUsers() {
  try {
    if (isSqlite()) {
      await initMemUsers();
      logger.info('[auth] seeded default users (sqlite/memory mode)', { count: memUsers.length });
      return;
    }
    const db = getPool();
    await migratePostgres(db);
    const { rows } = await db.query<{ count: string }>('SELECT COUNT(*)::text as count FROM users');
    const count = Number(rows[0]?.count ?? '0');
    if (count > 0) return;
    for (const user of SEED_USERS) {
      const hash = await bcrypt.hash(user.password, 10);
      await db.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING;`,
        [user.username, hash, user.role],
      );
    }
    logger.info('[auth] seeded default users', { count: SEED_USERS.length });
  } catch (err) {
    logger.error('[auth] failed to seed users', { err: String(err) });
    throw err;
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const username = email.trim().toLowerCase();

  if (isSqlite()) {
    const user = memUsers.find(u => u.username === username);
    if (!user) return null;
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return null;
    return { id: username, name: nameFromUsername(username), email: username, role: user.role };
  }

  const db = getPool();
  const { rows } = await db.query<DbUserRow>(
    'SELECT user_id, username, password_hash, role FROM users WHERE username = $1 LIMIT 1',
    [username],
  );
  const user = rows[0];
  if (!user) return null;
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return null;
  const role = user.role as AuthUser['role'];
  if (![UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.VIEWER].includes(role)) return null;
  return { id: String(user.user_id), name: nameFromUsername(user.username), email: user.username, role };
}
