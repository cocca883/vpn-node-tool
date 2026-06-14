import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { query } from '@/storage/database/pg-client';
import * as fs from 'fs';
import * as path from 'path';

interface DbNode {
  id: number;
  protocol: string;
  address: string;
  port: number;
  account: string;
  password: string;
  node_name: string;
  encryption: string;
  network: string;
  tls: string;
  sni: string;
  path_val: string;
  host: string;
  alter_id: number;
  expiry_date: string;
  sort_order: number;
}

function buildAndroidUri(node: DbNode): string {
  switch (node.protocol) {
    case 'ss': {
      const userInfo = Buffer.from(`${node.encryption}:${node.password}`).toString('base64');
      return `ss://${userInfo}@${node.address}:${node.port}/#${encodeURIComponent(node.node_name)}`;
    }
    case 'vmess': {
      const vmessObj = {
        v: '2',
        ps: node.node_name,
        add: node.address,
        port: node.port,
        id: node.account,
        aid: node.alter_id || 0,
        scy: node.encryption || 'auto',
        net: node.network || 'tcp',
        type: 'none',
        host: node.host || '',
        path: node.path_val || '',
        tls: node.tls || '',
        sni: node.sni || '',
      };
      return `vmess://${Buffer.from(JSON.stringify(vmessObj)).toString('base64')}`;
    }
    case 'vless': {
      const params = new URLSearchParams();
      params.set('encryption', 'none');
      if (node.tls) params.set('security', node.tls);
      if (node.network) params.set('type', node.network);
      if (node.host) params.set('host', node.host);
      if (node.path_val) params.set('path', node.path_val);
      if (node.sni) params.set('sni', node.sni);
      return `vless://${node.account}@${node.address}:${node.port}/?${params.toString()}#${encodeURIComponent(node.node_name)}`;
    }
    case 'trojan': {
      const params = new URLSearchParams();
      if (node.tls) params.set('security', node.tls);
      params.set('type', node.network || 'tcp');
      if (node.sni) params.set('sni', node.sni);
      return `trojan://${node.password}@${node.address}:${node.port}/?${params.toString()}#${encodeURIComponent(node.node_name)}`;
    }
    case 'socks5': {
      return `socks5://${node.account}:${node.password}@${node.address}:${node.port}/#${encodeURIComponent(node.node_name)}`;
    }
    default:
      return '';
  }
}

function buildIosUri(node: DbNode): string {
  switch (node.protocol) {
    case 'ss': {
      const userInfo = Buffer.from(`${node.encryption}:${node.password}`).toString('base64');
      return `ss://${userInfo}@${node.address}:${node.port}?remarks=${encodeURIComponent(node.node_name)}`;
    }
    case 'vmess': {
      const vmessObj = {
        v: '2',
        ps: node.node_name,
        add: node.address,
        port: node.port,
        id: node.account,
        aid: node.alter_id || 0,
        scy: node.encryption || 'auto',
        net: node.network || 'tcp',
        type: 'none',
        host: node.host || '',
        path: node.path_val || '',
        tls: node.tls || '',
        sni: node.sni || '',
      };
      const encoded = Buffer.from(JSON.stringify(vmessObj)).toString('base64');
      return `vmess://${encoded}?remarks=${encodeURIComponent(node.node_name)}`;
    }
    case 'vless': {
      // IOS: base64 encode the part between // and ?
      const authPart = node.account;
      const serverPart = `${node.address}:${node.port}`;
      const betweenPart = `${authPart}@${serverPart}`;
      const encodedBetween = Buffer.from(betweenPart).toString('base64');
      const params = new URLSearchParams();
      params.set('encryption', 'none');
      if (node.tls) params.set('security', node.tls);
      if (node.network) params.set('type', node.network);
      if (node.host) params.set('host', node.host);
      if (node.path_val) params.set('path', node.path_val);
      if (node.sni) params.set('sni', node.sni);
      params.set('remarks', node.node_name);
      return `vless://${encodedBetween}?${params.toString()}`;
    }
    case 'trojan': {
      // IOS: base64 encode password@host:port
      const betweenPart = `${node.password}@${node.address}:${node.port}`;
      const encodedBetween = Buffer.from(betweenPart).toString('base64');
      const params = new URLSearchParams();
      if (node.tls) params.set('security', node.tls);
      params.set('type', node.network || 'tcp');
      if (node.sni) params.set('sni', node.sni);
      params.set('remarks', node.node_name);
      return `trojan://${encodedBetween}?${params.toString()}`;
    }
    case 'socks5': {
      // IOS: protocol is "socks" (not socks5), base64 encode user:pass@host:port
      const betweenPart = `${node.account}:${node.password}@${node.address}:${node.port}`;
      const encodedBetween = Buffer.from(betweenPart).toString('base64');
      return `socks://${encodedBetween}?remarks=${encodeURIComponent(node.node_name)}`;
    }
    default:
      return '';
  }
}

// POST /api/generate
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status });
    }

    const body = await request.json();
    const { nodeIds, platform } = body as { nodeIds: number[]; platform: 'android' | 'ios' };

    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return NextResponse.json({ error: '请选择至少一个节点' }, { status: 400 });
    }

    if (!platform || (platform !== 'android' && platform !== 'ios')) {
      return NextResponse.json({ error: '请指定平台类型' }, { status: 400 });
    }

    const nodeResult = await query(
      `
        select *
        from vpn_nodes
        where id = any($1::int[])
          and user_id = $2
        order by sort_order asc, id asc
      `,
      [nodeIds, user.id]
    );
    const nodes = nodeResult.rows;

    if (!nodes || nodes.length === 0) {
      return NextResponse.json({ error: '未找到选中的节点' }, { status: 404 });
    }

    // Map DB fields to our interface
    const mappedNodes: DbNode[] = nodes.map((n: Record<string, unknown>) => ({
      id: n.id as number,
      protocol: n.protocol as string,
      address: n.address as string,
      port: n.port as number,
      account: n.account as string,
      password: n.password as string,
      node_name: n.node_name as string,
      encryption: n.encryption as string,
      network: n.network as string,
      tls: n.tls as string,
      sni: n.sni as string,
      path_val: (n as Record<string, unknown>).path as string,
      host: n.host as string,
      alter_id: n.alter_id as number,
      expiry_date: (n as Record<string, unknown>).expiry_date as string,
      sort_order: n.sort_order as number,
    }));

    const configResult = await query<{ key: string; value: string }>(
      `
        select key, value
        from system_config
        where key = any($1::text[])
      `,
      [['android_filename', 'ios_filename', 'ios_rename_hash', 'ios_socks_prefix', 'android_port_suffix']]
    );

    const configMap: Record<string, string> = {};
    for (const row of configResult.rows) {
      configMap[row.key] = row.value;
    }

    // Build URIs
    const uris = mappedNodes.map(node =>
      platform === 'android' ? buildAndroidUri(node) : buildIosUri(node)
    ).filter(Boolean);

    // Store content
    const isProd = process.env.COZE_PROJECT_ENV === 'PROD';
    let filename: string;
    let content: string;

    if (platform === 'android') {
      // Android: plain text, no base64
      filename = configMap['android_filename'] || 'mlkVPN468_Android';
      content = uris.join('\n');
    } else {
      // IOS: base64 encode the whole content
      filename = configMap['ios_filename'] || 'mlkVPN468_IOS';
      content = Buffer.from(uris.join('\n')).toString('base64');
    }

    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || '';

    if (isProd) {
      // Write to /tmp/subscriptions/
      const tmpDir = '/tmp/subscriptions';
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      fs.writeFileSync(path.join(tmpDir, filename), content, 'utf-8');

      return NextResponse.json({
        success: true,
        data: {
          uris,
          content,
          filename,
          urlPath: `/api/subscription/${filename}`,
          fullUrl: `${domain}/api/subscription/${filename}`,
          platform,
        },
      });
    } else {
      // Dev: write to public/subscriptions/
      const publicDir = path.join(process.cwd(), 'public', 'subscriptions');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(path.join(publicDir, filename), content, 'utf-8');

      return NextResponse.json({
        success: true,
        data: {
          uris,
          content,
          filename,
          urlPath: `/subscriptions/${filename}`,
          fullUrl: `${domain}/subscriptions/${filename}`,
          platform,
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Generate error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
