import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

interface NodeInput {
  protocol: 'ss' | 'vmess' | 'vless' | 'trojan';
  address: string;
  port: number;
  account: string;
  password: string;
  nodeName: string;
  // Optional fields
  encryption?: string;
  network?: string;
  tls?: string;
  security?: string;
  sni?: string;
  path?: string;
  host?: string;
  alterId?: number;
}

function generateSSUri(node: NodeInput): string {
  const userInfo = Buffer.from(`${node.encryption || 'aes-256-gcm'}:${node.password}`).toString('base64');
  return `ss://${userInfo}@${node.address}:${node.port}#${encodeURIComponent(node.nodeName)}`;
}

function generateVMessUri(node: NodeInput): string {
  const config = {
    v: '2',
    ps: node.nodeName,
    add: node.address,
    port: node.port,
    id: node.account,
    aid: node.alterId || 0,
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

function generateVLESSUri(node: NodeInput): string {
  const params = new URLSearchParams();
  params.set('encryption', 'none');
  if (node.security || node.tls) params.set('security', node.tls || 'tls');
  if (node.network) params.set('type', node.network);
  if (node.sni) params.set('sni', node.sni);
  if (node.host) params.set('host', node.host);
  if (node.path) params.set('path', node.path);
  return `vless://${node.account}@${node.address}:${node.port}?${params.toString()}#${encodeURIComponent(node.nodeName)}`;
}

function generateTrojanUri(node: NodeInput): string {
  const params = new URLSearchParams();
  params.set('security', node.tls || 'tls');
  params.set('type', node.network || 'tcp');
  if (node.sni) params.set('sni', node.sni);
  if (node.host) params.set('host', node.host);
  if (node.path) params.set('path', node.path);
  return `trojan://${node.password}@${node.address}:${node.port}?${params.toString()}#${encodeURIComponent(node.nodeName)}`;
}

function generateNodeUri(node: NodeInput): string {
  switch (node.protocol) {
    case 'ss':
      return generateSSUri(node);
    case 'vmess':
      return generateVMessUri(node);
    case 'vless':
      return generateVLESSUri(node);
    case 'trojan':
      return generateTrojanUri(node);
    default:
      throw new Error(`Unsupported protocol: ${node.protocol}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodes } = body as { nodes: NodeInput[] };

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json({ error: '请至少提供一个节点信息' }, { status: 400 });
    }

    // Validate required fields
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node.protocol) {
        return NextResponse.json({ error: `第 ${i + 1} 个节点缺少协议类型` }, { status: 400 });
      }
      if (!node.address) {
        return NextResponse.json({ error: `第 ${i + 1} 个节点缺少地址` }, { status: 400 });
      }
      if (!node.port) {
        return NextResponse.json({ error: `第 ${i + 1} 个节点缺少端口` }, { status: 400 });
      }
    }

    // Generate URIs for all nodes
    const uris: string[] = [];
    for (const node of nodes) {
      try {
        const uri = generateNodeUri(node);
        uris.push(uri);
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
        return NextResponse.json({ error: `节点 "${node.nodeName}" 生成失败: ${message}` }, { status: 400 });
      }
    }

    // Join URIs with newlines and base64 encode
    const joinedUris = uris.join('\n');
    const base64Result = Buffer.from(joinedUris).toString('base64');

    // Generate unique filename
    const fileId = crypto.randomUUID().slice(0, 8);
    const filename = `sub_${fileId}.txt`;

    // Determine storage path
    const isProd = process.env.COZE_PROJECT_ENV === 'PROD';
    const publicDir = isProd ? '/tmp/subscriptions' : path.join(process.cwd(), 'public', 'subscriptions');
    const filePath = path.join(publicDir, filename);

    // Ensure directory exists
    await fs.mkdir(publicDir, { recursive: true });

    // Write the base64 encoded content to file
    await fs.writeFile(filePath, base64Result, 'utf-8');

    // Construct the URL path
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || '';
    const urlPath = isProd
      ? `/api/subscription/${filename}`
      : `/subscriptions/${filename}`;
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
