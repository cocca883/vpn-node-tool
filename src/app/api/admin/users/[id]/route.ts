import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-helper';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// PUT /api/admin/users/[id] - Toggle user banned status or admin role
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin: isReqAdmin, error, status } = await getAdminUser(req);
  if (!isReqAdmin) {
    return NextResponse.json({ error: error || '无管理员权限' }, { status });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body as { action: 'ban' | 'unban' | 'add_admin' | 'remove_admin' };

    const serviceClient = getSupabaseClient();

    if (action === 'ban' || action === 'unban') {
      const banned = action === 'ban';
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
    }

    if (action === 'add_admin') {
      // Get user email from auth admin API
      const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(id);
      if (userError || !userData.user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }

      const { error: insertError } = await serviceClient
        .from('admin_users')
        .upsert(
          { user_id: id, email: userData.user.email || '未知', role: 'admin' },
          { onConflict: 'user_id' }
        );

      if (insertError) {
        return NextResponse.json({ error: '设置管理员失败: ' + insertError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '已设为管理员' });
    }

    if (action === 'remove_admin') {
      const { error: deleteError } = await serviceClient
        .from('admin_users')
        .delete()
        .eq('user_id', id);

      if (deleteError) {
        return NextResponse.json({ error: '移除管理员失败: ' + deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '已移除管理员' });
    }

    return NextResponse.json({ error: '无效操作，仅支持 ban/unban/add_admin/remove_admin' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - same as PUT for compatibility
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return PUT(req, ctx);
}
