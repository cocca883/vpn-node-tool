import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthenticatedUser } from '@/lib/auth-helper';

// GET /api/nodes/list
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('vpn_nodes')
      .select('*')
      .eq('user_id', user!.id)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`查询节点列表失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('List nodes error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
