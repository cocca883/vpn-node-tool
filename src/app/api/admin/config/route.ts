import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-helper';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/admin/config - Get all system configs
export async function GET(req: NextRequest) {
  const { isAdmin, error, status } = await getAdminUser(req);
  if (!isAdmin) {
    return NextResponse.json({ error: error || '无管理员权限' }, { status });
  }

  try {
    const serviceClient = getSupabaseClient();
    const { data, error: dbError } = await serviceClient
      .from('system_config')
      .select('*');

    if (dbError) {
      return NextResponse.json({ error: '查询系统配置失败' }, { status: 500 });
    }

    // Convert array to object
    const config: Record<string, { value: string; description: string }> = {};
    for (const row of (data || [])) {
      config[row.key] = { value: row.value, description: row.description };
    }

    return NextResponse.json({ success: true, data: config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}

// PUT /api/admin/config - Update system configs
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

    const serviceClient = getSupabaseClient();

    // Update each config
    for (const [key, value] of Object.entries(configs)) {
      const { error: updateError } = await serviceClient
        .from('system_config')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (updateError) {
        return NextResponse.json({ error: `更新配置 ${key} 失败` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: '配置更新成功' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '服务器错误' }, { status: 500 });
  }
}
