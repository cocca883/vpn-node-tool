import { NextRequest } from 'next/server';
import { query } from '@/storage/database/pg-client';
import { getUserByToken } from '@/lib/local-auth-server';
import type { LocalUser } from '@/lib/local-auth-types';

interface AuthResult {
  user: LocalUser | null;
  error: string | null;
  status: number;
}

interface AdminResult extends AuthResult {
  isAdmin: boolean;
}

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthResult> {
  const token = req.headers.get('x-session') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { user: null, error: '请先登录', status: 401 };
  }

  const user = await getUserByToken(token);
  if (!user) {
    return { user: null, error: '认证失败', status: 401 };
  }

  const profile = await query<{ banned: boolean }>(
    'select banned from user_profiles where user_id = $1',
    [user.id]
  );

  if (profile.rows[0]?.banned) {
    return { user: null, error: '账号已被封禁', status: 403 };
  }

  return { user, error: null, status: 200 };
}

export async function getAdminUser(req: NextRequest): Promise<AdminResult> {
  const { user, error, status } = await getAuthenticatedUser(req);

  if (!user) {
    return { user: null, isAdmin: false, error, status };
  }

  const adminRecord = await query<{ role: string }>(
    'select role from admin_users where user_id = $1',
    [user.id]
  );

  if (!adminRecord.rows[0]) {
    return { user, isAdmin: false, error: '无管理员权限', status: 403 };
  }

  return { user, isAdmin: true, error: null, status: 200 };
}
