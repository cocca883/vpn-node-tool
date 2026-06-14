import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAdminUser } from '@/lib/auth-helper';
import { ensureLocalAuthTables } from '@/lib/local-auth-server';
import { query } from '@/storage/database/pg-client';

interface AdminUserRow {
  id: string;
  email: string;
  createdat: string;
  lastsignin: string | null;
  banned: boolean | null;
  nodecount: string;
  isadmin: boolean;
}

export async function GET(req: NextRequest) {
  const { isAdmin, error, status } = await getAdminUser(req);
  if (!isAdmin) {
    return NextResponse.json({ error: error || '无管理员权限' }, { status });
  }

  try {
    await ensureLocalAuthTables();

    const result = await query<AdminUserRow>(`
      select
        u.id,
        u.email,
        u.created_at::text as "createdat",
        u.last_sign_in_at::text as "lastsignin",
        coalesce(p.banned, false) as banned,
        count(n.id)::text as "nodecount",
        (a.user_id is not null) as "isadmin"
      from app_users u
      left join user_profiles p on p.user_id = u.id
      left join admin_users a on a.user_id = u.id
      left join vpn_nodes n on n.user_id = u.id
      group by u.id, u.email, u.created_at, u.last_sign_in_at, p.banned, a.user_id
      order by u.created_at desc
    `);

    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      createdAt: row.createdat,
      lastSignIn: row.lastsignin,
      banned: row.banned === true,
      nodeCount: Number(row.nodecount),
      isAdmin: row.isadmin,
    }));

    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
