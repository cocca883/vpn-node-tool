import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthenticatedUser } from '@/lib/auth-helper';

interface NodeInput {
  protocol: string;
  address: string;
  port: number;
  account: string;
  password: string;
  nodeName: string;
  encryption?: string;
  network?: string;
  tls?: string;
  sni?: string;
  path?: string;
  host?: string;
  alterId?: number;
  expiryDate?: string;
  region?: string;
}

// POST: Add a single node
async function addSingleNode(node: NodeInput, userId: string) {
  const client = getSupabaseClient();

  // Get max sort_order
  const { data: maxSortData, error: maxSortError } = await client
    .from('vpn_nodes')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (maxSortError) {
    throw new Error(`查询排序失败: ${maxSortError.message}`);
  }

  const nextSort = (maxSortData && maxSortData.length > 0) ? maxSortData[0].sort_order + 1 : 0;

  const { data, error } = await client
    .from('vpn_nodes')
    .insert({
      protocol: node.protocol,
      address: node.address,
      port: node.port,
      account: node.account || '',
      password: node.password || '',
      node_name: node.nodeName,
      encryption: node.encryption || '',
      network: node.network || 'tcp',
      tls: node.tls || '',
      sni: node.sni || '',
      path: node.path || '',
      host: node.host || '',
      alter_id: node.alterId || 0,
      expiry_date: node.expiryDate || '',
      region: node.region || '',
      user_id: userId,
      sort_order: nextSort,
    })
    .select();

  if (error) {
    throw new Error(`添加节点失败: ${error.message}`);
  }

  return data[0];
}

// POST /api/nodes - Add single or batch nodes
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status });
    }

    const body = await request.json();

    // Batch import: { nodes: NodeInput[] }
    if (body.nodes && Array.isArray(body.nodes)) {
      const results = [];
      for (const node of body.nodes as NodeInput[]) {
        if (!node.protocol || !node.address || !node.port || !node.nodeName) continue;
        try {
          const result = await addSingleNode(node, user!.id);
          results.push(result);
        } catch {
          // Skip failed nodes
        }
      }
      return NextResponse.json({ success: true, data: results, count: results.length });
    }

    // Single node: { protocol, address, port, ... }
    const node = body as NodeInput;

    if (!node.protocol) {
      return NextResponse.json({ error: '缺少协议类型' }, { status: 400 });
    }
    if (!node.address) {
      return NextResponse.json({ error: '缺少服务器地址' }, { status: 400 });
    }
    if (!node.port) {
      return NextResponse.json({ error: '缺少端口' }, { status: 400 });
    }
    if (!node.nodeName) {
      return NextResponse.json({ error: '缺少节点名称' }, { status: 400 });
    }

    const data = await addSingleNode(node, user!.id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Add node error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
