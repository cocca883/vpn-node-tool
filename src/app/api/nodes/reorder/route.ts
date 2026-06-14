import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { query } from '@/storage/database/pg-client';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status });
    }

    const body = await request.json();
    const items: Array<{ id: number; sort_order: number }> = body.items;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: '缺少排序数据' }, { status: 400 });
    }

    for (const item of items) {
      await query(
        'update vpn_nodes set sort_order = $1, updated_at = now() where id = $2 and user_id = $3',
        [item.sort_order, item.id, user.id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Reorder error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
