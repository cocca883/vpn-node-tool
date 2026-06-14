import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAdminUser } from '@/lib/auth-helper';
import { query } from '@/storage/database/pg-client';

const SUPER_ADMIN_EMAIL = 'zhangyg10@163.com';

async function getUserEmail(userId: string): Promise<string | null> {
  const result = await query<{ email: string }>('select email from app_users where id = $1', [userId]);
  return result.rows[0]?.email ?? null;
}

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

    const email = await getUserEmail(id);
    if (!email) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const isTargetSuperAdmin = email === SUPER_ADMIN_EMAIL;

    if (action === 'ban' || action === 'unban') {
      if (isTargetSuperAdmin) {
        return NextResponse.json({ error: '不能对总管理员执行此操作' }, { status: 403 });
      }

      const banned = action === 'ban';
      await query(
        `
          insert into user_profiles (user_id, email, banned)
          values ($1, $2, $3)
          on conflict (user_id) do update
          set email = excluded.email,
              banned = excluded.banned
        `,
        [id, email, banned]
      );

      return NextResponse.json({ success: true, message: banned ? '用户已封禁' : '用户已解封' });
    }

    if (action === 'add_admin') {
      await query(
        `
          insert into admin_users (user_id, email, role)
          values ($1, $2, 'admin')
          on conflict (user_id) do update
          set email = excluded.email,
              role = excluded.role
        `,
        [id, email]
      );

      return NextResponse.json({ success: true, message: '已设为管理员' });
    }

    if (action === 'remove_admin') {
      if (isTargetSuperAdmin) {
        return NextResponse.json({ error: '不能移除总管理员权限' }, { status: 403 });
      }

      await query('delete from admin_users where user_id = $1', [id]);
      return NextResponse.json({ success: true, message: '已移除管理员' });
    }

    return NextResponse.json({ error: '无效操作，仅支持 ban/unban/add_admin/remove_admin' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin, error, status } = await getAdminUser(req);
  if (!isAdmin) {
    return NextResponse.json({ error: error || '无管理员权限' }, { status });
  }

  try {
    const { id } = await params;
    const email = await getUserEmail(id);

    if (!email) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    if (email === SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: '不能删除总管理员' }, { status: 403 });
    }

    await query('delete from vpn_nodes where user_id = $1', [id]);
    await query('delete from admin_users where user_id = $1', [id]);
    await query('delete from user_profiles where user_id = $1', [id]);
    await query('delete from app_sessions where user_id = $1', [id]);
    await query('delete from app_users where id = $1', [id]);

    return NextResponse.json({ success: true, message: '用户已删除' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
