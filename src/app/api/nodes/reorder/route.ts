import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface ReorderItem {
  id: number;
  sort_order: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body as { items: ReorderItem[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '缺少排序数据' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Update sort_order for each item
    for (const item of items) {
      const { error } = await client
        .from('vpn_nodes')
        .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
        .eq('id', item.id);

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
