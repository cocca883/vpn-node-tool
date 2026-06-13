import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface NodeData {
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
  path: string;
  host: string;
  alter_id: number;
}

function generateSSUri(node: NodeData): string {
  const userInfo = Buffer.from(`${node.encryption || 'aes-256-gcm'}:${node.password}`).toString('base64');
  return `ss://${userInfo}@${node.address}:${node.port}#${encodeURIComponent(node.node_name)}`;
}

function generateVMessUri(node: NodeData): string {
  const config = {
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
    path: node.path || '',
    tls: node.tls || '',
    sni: node.sni || '',
  };
  return `vmess://${Buffer.from(JSON.stringify(config)).toString('base64')}`;
}

function generateVLESSUri(node: NodeData): string {
  const params = new URLSearchParams();
  params.set('encryption', 'none');
  if (node.tls) params.set('security', node.tls);
  if (node.network) params.set('type', node.network);
  if (node.sni) params.set('sni', node.sni);
  if (node.host) params.set('host', node.host);
  if (node.path) params.set('path', node.path);
  return `vless://${node.account}@${node.address}:${node.port}?${params.toString()}#${encodeURIComponent(node.node_name)}`;
}

function generateTrojanUri(node: NodeData): string {
  const params = new URLSearchParams();
  params.set('security', node.tls || 'tls');
  params.set('type', node.network || 'tcp');
  if (node.sni) params.set('sni', node.sni);
  if (node.host) params.set('host', node.host);
  if (node.path) params.set('path', node.path);
  return `trojan://${node.password}@${node.address}:${node.port}?${params.toString()}#${encodeURIComponent(node.node_name)}`;
}

function generateSocks5Uri(node: NodeData): string {
  const userInfo = node.account ? `${node.account}:${node.password}@` : '';
  return `socks5://${userInfo}${node.address}:${node.port}#${encodeURIComponent(node.node_name)}`;
}

function generateNodeUri(node: NodeData): string {
  switch (node.protocol) {
    case 'ss':
      return generateSSUri(node);
    case 'vmess':
      return generateVMessUri(node);
    case 'vless':
      return generateVLESSUri(node);
    case 'trojan':
      return generateTrojanUri(node);
    case 'socks5':
      return generateSocks5Uri(node);
    default:
      throw new Error(`Unsupported protocol: ${node.protocol}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeIds } = body as { nodeIds: number[] };

    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return NextResponse.json({ error: '请至少选择一个节点' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Fetch selected nodes from database
    const { data: nodes, error } = await client
      .from('vpn_nodes')
      .select('*')
      .in('id', nodeIds)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`查询节点失败: ${error.message}`);
    }

    if (!nodes || nodes.length === 0) {
      return NextResponse.json({ error: '未找到选中的节点' }, { status: 404 });
    }

    // Generate URIs
    const uris: string[] = [];
    for (const node of nodes) {
      try {
        const uri = generateNodeUri(node as NodeData);
        uris.push(uri);
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
        return NextResponse.json({ error: `节点 "${node.node_name}" 生成失败: ${message}` }, { status: 400 });
      }
    }

    // Join and base64 encode
    const joinedUris = uris.join('\n');
    const base64Result = Buffer.from(joinedUris).toString('base64');

    // Save to file
    const fileId = crypto.randomUUID().slice(0, 8);
    const filename = `sub_${fileId}.txt`;

    const isProd = process.env.COZE_PROJECT_ENV === 'PROD';
    const publicDir = isProd ? '/tmp/subscriptions' : path.join(process.cwd(), 'public', 'subscriptions');
    const filePath = path.join(publicDir, filename);

    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(filePath, base64Result, 'utf-8');

    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || '';
    const urlPath = isProd ? `/api/subscription/${filename}` : `/subscriptions/${filename}`;
    const fullUrl = domain ? `${domain}${urlPath}` : urlPath;

    return NextResponse.json({
      success: true,
      data: {
        uris,
        base64: base64Result,
        filename,
        urlPath,
        fullUrl,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Generate error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
