import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAdminUser } from '@/lib/auth-helper';
import { query } from '@/storage/database/pg-client';

export async function GET(req: NextRequest) {
  const { isAdmin, error, status } = await getAdminUser(req);
  if (!isAdmin) {
    return NextResponse.json({ error: error || '无管理员权限' }, { status });
  }

  try {
    const totalNodes = await query<{ count: string }>('select count(*)::text as count from vpn_nodes');
    const totalUsers = await query<{ count: string }>('select count(*)::text as count from app_users');
    const protocolRows = await query<{ protocol: string; count: string }>(
      'select protocol, count(*)::text as count from vpn_nodes group by protocol order by protocol'
    );
    const regionRows = await query<{ region: string; count: string }>(
      `
        select region, count(*)::text as count
        from vpn_nodes
        where region <> ''
        group by region
        order by region
      `
    );
    const expiryRows = await query<{ expiry_date: string }>(
      'select expiry_date from vpn_nodes where expiry_date <> \'\''
    );

    const today = new Date().toISOString().split('T')[0];
    let expiredCount = 0;
    let activeCount = 0;
    for (const row of expiryRows.rows) {
      if (row.expiry_date < today) expiredCount++;
      else activeCount++;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalNodes: Number(totalNodes.rows[0]?.count || 0),
        totalUsers: Number(totalUsers.rows[0]?.count || 0),
        protocolDistribution: protocolRows.rows.map(row => ({
          protocol: row.protocol,
          count: Number(row.count),
        })),
        regionDistribution: regionRows.rows.map(row => ({
          region: row.region,
          count: Number(row.count),
        })),
        expiredNodes: expiredCount,
        activeNodes: activeCount,
        noExpiryNodes: Number(totalNodes.rows[0]?.count || 0) - expiredCount - activeCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
