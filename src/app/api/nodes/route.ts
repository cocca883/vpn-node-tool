import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { query } from '@/storage/database/pg-client';

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

async function addSingleNode(node: NodeInput, userId: string) {
  const maxSort = await query<{ sort_order: number }>(
    `
      select sort_order
      from vpn_nodes
      where user_id = $1
      order by sort_order desc
      limit 1
    `,
    [userId]
  );
  const nextSort = maxSort.rows[0] ? maxSort.rows[0].sort_order + 1 : 0;

  const result = await query(
    `
      insert into vpn_nodes (
        protocol, address, port, account, password, node_name, encryption,
        network, tls, sni, path, host, alter_id, expiry_date, region, user_id, sort_order
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      returning *
    `,
    [
      node.protocol,
      node.address,
      node.port,
      node.account || '',
      node.password || '',
      node.nodeName,
      node.encryption || '',
      node.network || 'tcp',
      node.tls || '',
      node.sni || '',
      node.path || '',
      node.host || '',
      node.alterId || 0,
      node.expiryDate || '',
      node.region || '',
      userId,
      nextSort,
    ]
  );

  return result.rows[0];
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status });
    }

    const body = await request.json();

    if (body.nodes && Array.isArray(body.nodes)) {
      const results = [];
      for (const node of body.nodes as NodeInput[]) {
        if (!node.protocol || !node.address || !node.port || !node.nodeName) continue;
        const result = await addSingleNode(node, user.id);
        results.push(result);
      }
      return NextResponse.json({ success: true, data: results, count: results.length });
    }

    const node = body as NodeInput;
    if (!node.protocol) return NextResponse.json({ error: '缺少协议类型' }, { status: 400 });
    if (!node.address) return NextResponse.json({ error: '缺少服务器地址' }, { status: 400 });
    if (!node.port) return NextResponse.json({ error: '缺少端口' }, { status: 400 });
    if (!node.nodeName) return NextResponse.json({ error: '缺少节点名称' }, { status: 400 });

    const data = await addSingleNode(node, user.id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Add node error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
