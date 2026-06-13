import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface ParsedNode {
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
  expiryDate?: string;
  region?: string;
}

// Known protocol prefixes
const PROTOCOLS = ['socks5', 'socks', 'ss', 'vmess', 'vless', 'trojan'];

function parseSingleLine(line: string): ParsedNode | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try parsing as URI format: protocol://...
  const uriMatch = trimmed.match(/^(socks5|socks|ss|vmess|vless|trojan):\/\/(.+)$/i);
  if (uriMatch) {
    return parseUri(uriMatch[1].toLowerCase(), uriMatch[2]);
  }

  // Try parsing as delimited format: field1|field2|... or field1/field2/...
  // Common format: protocol|address|port|account|password|name[|expiry]
  // Or: protocol/address/port/account/password/name[/expiry]
  const delimiter = trimmed.includes('|') ? '|' : trimmed.includes('/') ? '/' : null;
  if (delimiter) {
    return parseDelimited(trimmed, delimiter);
  }

  return null;
}

function parseUri(protocol: string, rest: string): ParsedNode | null {
  try {
    switch (protocol) {
      case 'ss': {
        // ss://base64(method:password)@host:port#name
        // or ss://base64(method:password@host:port)#name
        const hashIdx = rest.lastIndexOf('#');
        const name = hashIdx !== -1 ? decodeURIComponent(rest.substring(hashIdx + 1)) : 'SS节点';
        const mainPart = hashIdx !== -1 ? rest.substring(0, hashIdx) : rest;

        let method = '';
        let password = '';
        let address = '';
        let port = 0;

        if (mainPart.includes('@')) {
          // Format: base64(method:password)@host:port
          const atIdx = mainPart.indexOf('@');
          const encoded = mainPart.substring(0, atIdx);
          const serverPart = mainPart.substring(atIdx + 1);
          const decoded = Buffer.from(encoded, 'base64').toString();
          const colonIdx = decoded.indexOf(':');
          method = decoded.substring(0, colonIdx);
          password = decoded.substring(colonIdx + 1);
          const serverColonIdx = serverPart.lastIndexOf(':');
          address = serverPart.substring(0, serverColonIdx);
          port = parseInt(serverPart.substring(serverColonIdx + 1), 10);
        } else {
          // Format: base64(method:password@host:port)
          const decoded = Buffer.from(mainPart, 'base64').toString();
          const atIdx = decoded.indexOf('@');
          const userInfo = decoded.substring(0, atIdx);
          const serverPart = decoded.substring(atIdx + 1);
          const colonIdx = userInfo.indexOf(':');
          method = userInfo.substring(0, colonIdx);
          password = userInfo.substring(colonIdx + 1);
          const serverColonIdx = serverPart.lastIndexOf(':');
          address = serverPart.substring(0, serverColonIdx);
          port = parseInt(serverPart.substring(serverColonIdx + 1), 10);
        }

        return {
          protocol: 'ss', address, port, account: method, password, nodeName: name, encryption: method,
        };
      }
      case 'vmess': {
        // vmess://base64(JSON)
        const decoded = Buffer.from(rest, 'base64').toString();
        const obj = JSON.parse(decoded);
        return {
          protocol: 'vmess',
          address: obj.add || '',
          port: obj.port || 0,
          account: obj.id || '',
          password: '',
          nodeName: obj.ps || 'VMess节点',
          encryption: obj.scy || 'auto',
          network: obj.net || 'tcp',
          tls: obj.tls || '',
          sni: obj.sni || '',
          path: obj.path || '',
          host: obj.host || '',
        };
      }
      case 'vless': {
        // vless://uuid@host:port?params#name
        const hashIdx = rest.lastIndexOf('#');
        const name = hashIdx !== -1 ? decodeURIComponent(rest.substring(hashIdx + 1)) : 'VLESS节点';
        const mainPart = hashIdx !== -1 ? rest.substring(0, hashIdx) : rest;
        const questionIdx = mainPart.indexOf('?');
        const authAndServer = questionIdx !== -1 ? mainPart.substring(0, questionIdx) : mainPart;
        const atIdx = authAndServer.indexOf('@');
        const uuid = authAndServer.substring(0, atIdx);
        const serverPart = authAndServer.substring(atIdx + 1);
        const serverColonIdx = serverPart.lastIndexOf(':');
        const address = serverPart.substring(0, serverColonIdx);
        const port = parseInt(serverPart.substring(serverColonIdx + 1), 10);

        return {
          protocol: 'vless', address, port, account: uuid, password: '', nodeName: name,
          tls: '', network: '', sni: '', path: '', host: '',
        };
      }
      case 'trojan': {
        // trojan://password@host:port?params#name
        const hashIdx = rest.lastIndexOf('#');
        const name = hashIdx !== -1 ? decodeURIComponent(rest.substring(hashIdx + 1)) : 'Trojan节点';
        const mainPart = hashIdx !== -1 ? rest.substring(0, hashIdx) : rest;
        const atIdx = mainPart.indexOf('@');
        const password = mainPart.substring(0, atIdx);
        const serverPart = mainPart.substring(atIdx + 1);
        const serverColonIdx = serverPart.lastIndexOf(':');
        const address = serverPart.substring(0, serverColonIdx);
        const port = parseInt(serverPart.substring(serverColonIdx + 1), 10);

        return {
          protocol: 'trojan', address, port, account: '', password, nodeName: name,
          tls: '', network: '', sni: '', path: '', host: '',
        };
      }
      case 'socks5':
      case 'socks': {
        // socks5://user:pass@host:port#name
        const hashIdx = rest.lastIndexOf('#');
        const name = hashIdx !== -1 ? decodeURIComponent(rest.substring(hashIdx + 1)) : 'SOCKS5节点';
        const mainPart = hashIdx !== -1 ? rest.substring(0, hashIdx) : rest;
        const atIdx = mainPart.indexOf('@');
        const userInfo = mainPart.substring(0, atIdx);
        const colonIdx = userInfo.indexOf(':');
        const account = userInfo.substring(0, colonIdx);
        const password = userInfo.substring(colonIdx + 1);
        const serverPart = mainPart.substring(atIdx + 1);
        const serverColonIdx = serverPart.lastIndexOf(':');
        const address = serverPart.substring(0, serverColonIdx);
        const port = parseInt(serverPart.substring(serverColonIdx + 1), 10);

        return {
          protocol: 'socks5', address, port, account, password, nodeName: name,
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function parseDelimited(line: string, delimiter: string): ParsedNode | null {
  const parts = line.split(delimiter).map(p => p.trim());
  if (parts.length < 4) return null;

  // Try to detect format:
  // Format 1: protocol|address|port|account|password|name[|encryption|...|expiry]
  // Format 2: address|port|account|password|name[|...|expiry]

  let protocol = '';
  let addressIdx = 0;

  // Check if first part is a known protocol
  const firstLower = parts[0].toLowerCase();
  if (PROTOCOLS.includes(firstLower)) {
    protocol = firstLower === 'socks' ? 'socks5' : firstLower;
    addressIdx = 1;
  } else {
    // Guess protocol from number of fields or default to socks5
    protocol = 'socks5';
    addressIdx = 0;
  }

  const remaining = parts.slice(addressIdx);
  if (remaining.length < 3) return null;

  const address = remaining[0];
  const port = parseInt(remaining[1], 10);
  if (isNaN(port)) return null;

  const account = remaining.length > 2 ? remaining[2] : '';
  const password = remaining.length > 3 ? remaining[3] : '';
  const expiryDate = remaining.length > 4 ? remaining[4] : '';
  const nodeName = remaining.length > 5 ? remaining[5] : `${protocol}-${address}`;
  const region = remaining.length > 6 ? remaining[6] : '';
  const encryption = remaining.length > 7 ? remaining[7] : '';

  return {
    protocol,
    address,
    port,
    account,
    password,
    nodeName,
    region,
    encryption: protocol === 'ss' ? encryption || 'aes-256-gcm' : encryption,
    expiryDate,
  };
}

// POST /api/nodes/smart-import
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError, status } = await getAuthenticatedUser(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status });
    }

    const body = await request.json();
    const { text } = body as { text: string };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: '请输入节点数据' }, { status: 400 });
    }

    // Parse each line
    const lines = text.split('\n');
    const parsedNodes: ParsedNode[] = [];

    for (const line of lines) {
      const node = parseSingleLine(line);
      if (node) {
        parsedNodes.push(node);
      }
    }

    if (parsedNodes.length === 0) {
      return NextResponse.json({ error: '未能识别到有效的节点数据，请检查格式' }, { status: 400 });
    }

    // Batch insert into database
    const client = getSupabaseClient();

    // Get max sort_order for this user
    const { data: maxSortData } = await client
      .from('vpn_nodes')
      .select('sort_order')
      .eq('user_id', user!.id)
      .order('sort_order', { ascending: false })
      .limit(1);

    let nextSort = (maxSortData && maxSortData.length > 0) ? maxSortData[0].sort_order + 1 : 0;

    const insertData = parsedNodes.map(node => ({
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
      alter_id: 0,
      expiry_date: node.expiryDate || '',
      region: node.region || '',
      user_id: user!.id,
      sort_order: nextSort++,
    }));

    const { data, error } = await client
      .from('vpn_nodes')
      .insert(insertData)
      .select();

    if (error) {
      throw new Error(`批量导入失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      parsed: parsedNodes.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('Smart import error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
