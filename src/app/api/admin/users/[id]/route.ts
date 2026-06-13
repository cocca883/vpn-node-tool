import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-helper';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// PUT /api/admin/users/[id] - Toggle user banned status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin, error, status } = await getAdminUser(req);
  if (!isAdmin) {
    return NextResponse.json({ error: error || '无管理员权限' }, { status });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body as { action: 'ban' | 'unban' };

    if (!action || !['ban', 'unban'].includes(action)) {
      return NextResponse.json({ error: '无效操作，仅支持 ban/unban' }, { status: 400 });
    }

    const serviceClient = getSupabaseClient();
    const banned = action === 'ban';

    // Upsert user_profiles
    const { error: upsertError } = await serviceClient
      .from('user_profiles')
      .upsert(
        { user_id: id, banned, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      return NextResponse.json({ error: '操作失败: ' + upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: banned ? '用户已封禁' : '用户已解封',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
