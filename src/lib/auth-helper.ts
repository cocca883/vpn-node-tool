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

  return { user, error: null, status: 200 };
}
