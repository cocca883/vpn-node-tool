import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-helper';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/admin/stats - Get node statistics
export async function GET(req: NextRequest) {
  const { isAdmin, error, status } = await getAdminUser(req);
  if (!isAdmin) {
    return NextResponse.json({ error: error || '无管理员权限' }, { status });
  }

  try {
    const serviceClient = getSupabaseClient();

    // Total node count
    const { count: totalNodes, error: countError } = await serviceClient
      .from('vpn_nodes')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({ error: '查询节点总数失败' }, { status: 500 });
    }

    // Protocol distribution
    const { data: protocolData, error: protocolError } = await serviceClient
      .from('vpn_nodes')
      .select('protocol');

    if (protocolError) {
      return NextResponse.json({ error: '查询协议分布失败' }, { status: 500 });
    }

    const protocolDist: Record<string, number> = {};
    for (const row of (protocolData || [])) {
      protocolDist[row.protocol] = (protocolDist[row.protocol] || 0) + 1;
    }

    // User count (distinct user_ids)
    const { data: userData, error: userError } = await serviceClient
      .from('vpn_nodes')
      .select('user_id')
      .not('user_id', 'is', null);

    if (userError) {
      return NextResponse.json({ error: '查询用户统计失败' }, { status: 500 });
    }

    const uniqueUsers = new Set((userData || []).map((r: any) => r.user_id)).size;

    // Region distribution
    const { data: regionData, error: regionError } = await serviceClient
      .from('vpn_nodes')
      .select('region')
      .neq('region', '');

    if (regionError) {
      return NextResponse.json({ error: '查询地区分布失败' }, { status: 500 });
    }

    const regionDist: Record<string, number> = {};
    for (const row of (regionData || [])) {
      if (row.region) {
        regionDist[row.region] = (regionDist[row.region] || 0) + 1;
      }
    }

    // Expiry stats
    const { data: expiryData, error: expiryError } = await serviceClient
      .from('vpn_nodes')
      .select('expiry_date')
      .neq('expiry_date', '');

    const today = new Date().toISOString().split('T')[0];
    let expiredCount = 0;
    let activeCount = 0;
    for (const row of (expiryData || [])) {
      if (row.expiry_date && row.expiry_date < today) {
        expiredCount++;
      } else if (row.expiry_date) {
        activeCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalNodes: totalNodes || 0,
        totalUsers: uniqueUsers,
        protocolDistribution: protocolDist,
        regionDistribution: regionDist,
        expiredNodes: expiredCount,
        activeNodes: activeCount,
        noExpiryNodes: (totalNodes || 0) - expiredCount - activeCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}
