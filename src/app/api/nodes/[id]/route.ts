import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const nodeId = Number(id);

    if (isNaN(nodeId)) {
      return NextResponse.json({ error: '无效的节点 ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from('vpn_nodes')
      .delete()
      .eq('id', nodeId);

    if (error) {
      throw new Error(`删除节点失败: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Delete node error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
