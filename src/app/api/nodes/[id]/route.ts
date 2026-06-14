import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { query } from '@/storage/database/pg-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status });
    }

    const { id } = await params;
    const nodeId = parseInt(id, 10);
    if (isNaN(nodeId)) {
      return NextResponse.json({ error: '无效的节点ID' }, { status: 400 });
    }

    await query('delete from vpn_nodes where id = $1 and user_id = $2', [nodeId, user.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Delete node error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
