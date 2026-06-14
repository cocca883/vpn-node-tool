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
    const result = await query<{ key: string; value: string; description: string | null }>(
      'select key, value, description from system_config order by key'
    );

    const config: Record<string, { value: string; description: string | null }> = {};
    for (const row of result.rows) {
      config[row.key] = { value: row.value, description: row.description };
    }

    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { isAdmin, error, status } = await getAdminUser(req);
  if (!isAdmin) {
    return NextResponse.json({ error: error || '无管理员权限' }, { status });
  }

  try {
    const body = await req.json();
    const { configs } = body as { configs: Record<string, string> };

    if (!configs || typeof configs !== 'object') {
      return NextResponse.json({ error: '无效的配置数据' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(configs)) {
      await query('update system_config set value = $1, updated_at = now() where key = $2', [value, key]);
    }

    return NextResponse.json({ success: true, message: '配置更新成功' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
