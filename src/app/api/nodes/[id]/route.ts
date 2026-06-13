import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthenticatedUser } from '@/lib/auth-helper';

// DELETE /api/nodes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status });
    }

    const { id } = await params;
    const nodeId = parseInt(id, 10);

    if (isNaN(nodeId)) {
      return NextResponse.json({ error: '无效的节点ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Only delete nodes belonging to the current user
    const { error } = await client
      .from('vpn_nodes')
      .delete()
      .eq('id', nodeId)
      .eq('user_id', user!.id);

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
