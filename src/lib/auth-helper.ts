import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function getAuthenticatedUser(req: NextRequest) {
  const token = req.headers.get('x-session');

  if (!token) {
    return { user: null, error: '请先登录', status: 401 };
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    return { user: null, error: '认证失败', status: 401 };
  }

  // Check if user is banned
  const serviceClient = getSupabaseClient();
  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('banned')
    .eq('user_id', user.id)
    .single();

  if (profile?.banned) {
    return { user: null, error: '账号已被封禁', status: 403 };
  }

  return { user, error: null, status: 200 };
}

export async function getAdminUser(req: NextRequest) {
  const { user, error, status } = await getAuthenticatedUser(req);

  if (!user) {
    return { user: null, isAdmin: false, error, status };
  }

  // Check if user is in admin_users table
  const serviceClient = getSupabaseClient();
  const { data: adminRecord, error: adminError } = await serviceClient
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (adminError || !adminRecord) {
    return { user, isAdmin: false, error: '无管理员权限', status: 403 };
  }

  return { user, isAdmin: true, error: null, status: 200 };
}
