import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthenticatedUser } from '@/lib/auth-helper';

// POST /api/nodes/reorder
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status });
    }

    const body = await request.json();
    const items: Array<{ id: number; sort_order: number }> = body.items;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: '缺少排序数据' }, { status: 400 });
    }

    const client = getSupabaseClient();

    for (const item of items) {
      const { error } = await client
        .from('vpn_nodes')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('user_id', user!.id);

      if (error) {
        throw new Error(`更新排序失败: ${error.message}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Reorder error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
