import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('vpn_nodes')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`查询节点失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Get nodes error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
