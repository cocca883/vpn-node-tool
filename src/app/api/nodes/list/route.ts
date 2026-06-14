import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { query } from '@/storage/database/pg-client';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status });
    }

    const result = await query(
      `
        select *
        from vpn_nodes
        where user_id = $1
        order by sort_order asc, id asc
      `,
      [user.id]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('List nodes error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
