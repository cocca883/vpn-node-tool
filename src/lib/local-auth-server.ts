import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { query } from '@/storage/database/pg-client';
import type { LocalUser } from '@/lib/local-auth-types';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export async function ensureLocalAuthTables(): Promise<void> {
  await query(`
    create table if not exists app_users (
      id uuid primary key default gen_random_uuid(),
      email varchar(255) not null unique,
      password_hash text not null,
      created_at timestamptz not null default now(),
      last_sign_in_at timestamptz
    )
  `);

  await query(`
    create table if not exists app_sessions (
      token text primary key,
      user_id uuid not null references app_users(id) on delete cascade,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null
    )
  `);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const actual = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await query(
    `
      insert into app_sessions (token, user_id, expires_at)
      values ($1, $2, now() + interval '30 days')
    `,
    [token, userId]
  );
  return token;
}

export async function signUp(email: string, password: string): Promise<{ sessionToken: string; user: LocalUser }> {
  await ensureLocalAuthTables();

  const normalizedEmail = email.trim().toLowerCase();
  const userCount = await query<{ count: string }>('select count(*)::text as count from app_users');
  const isFirstUser = Number(userCount.rows[0]?.count || 0) === 0;
  const id = randomUUID();
  const passwordHash = hashPassword(password);

  const result = await query<UserRow>(
    `
      insert into app_users (id, email, password_hash, last_sign_in_at)
      values ($1, $2, $3, now())
      returning id, email, password_hash, created_at::text, last_sign_in_at::text
    `,
    [id, normalizedEmail, passwordHash]
  );

  const user = result.rows[0];
  const sessionToken = await createSession(user.id);
  await ensureProfile(user.id, user.email);

  if (isFirstUser || user.email === 'zhangyg10@163.com') {
    await query(
      `
        insert into admin_users (user_id, email, role)
        values ($1, $2, 'admin')
        on conflict (user_id) do update
        set email = excluded.email,
            role = excluded.role
      `,
      [user.id, user.email]
    );
  }

  if (isFirstUser) {
    await query('update vpn_nodes set user_id = $1 where user_id is null', [user.id]);
  }

  return { sessionToken, user: { id: user.id, email: user.email } };
}

export async function signIn(email: string, password: string): Promise<{ sessionToken: string; user: LocalUser } | null> {
  await ensureLocalAuthTables();

  const normalizedEmail = email.trim().toLowerCase();
  const result = await query<UserRow>(
    `
      select id, email, password_hash, created_at::text, last_sign_in_at::text
      from app_users
      where email = $1
    `,
    [normalizedEmail]
  );

  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  await query('update app_users set last_sign_in_at = now() where id = $1', [user.id]);
  const sessionToken = await createSession(user.id);
  await ensureProfile(user.id, user.email);

  return { sessionToken, user: { id: user.id, email: user.email } };
}

export async function signOut(token: string): Promise<void> {
  await ensureLocalAuthTables();
  await query('delete from app_sessions where token = $1', [token]);
}

export async function getUserByToken(token: string): Promise<LocalUser | null> {
  await ensureLocalAuthTables();

  const result = await query<{ id: string; email: string }>(
    `
      select u.id, u.email
      from app_sessions s
      join app_users u on u.id = s.user_id
      where s.token = $1
        and s.expires_at > now()
    `,
    [token]
  );

  return result.rows[0] ?? null;
}

export async function ensureProfile(userId: string, email: string): Promise<void> {
  await query(
    `
      insert into user_profiles (user_id, email, banned)
      values ($1, $2, false)
      on conflict (user_id) do update
      set email = excluded.email
    `,
    [userId, email]
  );
}
