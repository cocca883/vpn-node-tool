import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-helper';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/admin/users - List all users with their node counts
export async function GET(req: NextRequest) {
  const { isAdmin, error, status } = await getAdminUser(req);
  if (!isAdmin) {
    return NextResponse.json({ error: error || '无管理员权限' }, { status });
  }

  try {
    const serviceClient = getSupabaseClient();

    // Get all distinct user_ids from vpn_nodes with their node counts
    const { data: nodeStats, error: statsError } = await serviceClient
      .from('vpn_nodes')
      .select('user_id, id')
      .not('user_id', 'is', null);

    if (statsError) {
      return NextResponse.json({ error: '查询节点统计失败' }, { status: 500 });
    }

    // Aggregate node counts per user
    const userNodeMap = new Map<string, number>();
    for (const row of (nodeStats || [])) {
      const uid = row.user_id as string;
      userNodeMap.set(uid, (userNodeMap.get(uid) || 0) + 1);
    }

    // Get all users from auth.users via admin API
    // Since we can't directly query auth.users, we'll use the admin_users table
    // and vpn_nodes to build the user list
    const { data: adminUsers, error: adminError } = await serviceClient
      .from('admin_users')
      .select('user_id, email, role, created_at');

    if (adminError) {
      return NextResponse.json({ error: '查询管理员列表失败' }, { status: 500 });
    }

    // Build admin user set
    const adminSet = new Set((adminUsers || []).map((a: any) => a.user_id));

    // Get unique user_ids from nodes (these are all users who have added nodes)
    const userIds = [...userNodeMap.keys()];

    // Try to get user emails from auth.admin API
    // We need to use the Supabase admin API to list users
    const { data: authUsers, error: authError } = await serviceClient.auth.admin.listUsers();

    if (authError) {
      // Fallback: return just what we have from nodes
      const users = userIds.map(uid => ({
        id: uid,
        email: adminSet.has(uid) ? (adminUsers as any[]).find((a: any) => a.user_id === uid)?.email : '未知',
        nodeCount: userNodeMap.get(uid) || 0,
        isAdmin: adminSet.has(uid),
        banned: false,
      }));
      return NextResponse.json({ success: true, data: users });
    }

    // Get banned status from user_profiles
    const { data: profiles } = await serviceClient
      .from('user_profiles')
      .select('user_id, banned');

    const bannedMap = new Map<string, boolean>();
    for (const p of (profiles || [])) {
      bannedMap.set(p.user_id, p.banned);
    }

    // Merge auth users with node stats and banned status
    const allUsers = (authUsers.users || []).map((u: any) => ({
      id: u.id,
      email: u.email || '未知',
      nodeCount: userNodeMap.get(u.id) || 0,
      isAdmin: adminSet.has(u.id),
      banned: bannedMap.get(u.id) || false,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
    }));

    return NextResponse.json({ success: true, data: allUsers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}
