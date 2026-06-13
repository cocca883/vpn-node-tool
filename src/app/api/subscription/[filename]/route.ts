import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Prevent directory traversal
    if (filename.includes('/') || filename.includes('..')) {
      return NextResponse.json({ error: '无效的文件名' }, { status: 400 });
    }

    const isProd = process.env.COZE_PROJECT_ENV === 'PROD';
    const publicDir = isProd ? '/tmp/subscriptions' : path.join(process.cwd(), 'public', 'subscriptions');
    const filePath = path.join(publicDir, filename);

    const content = await fs.readFile(filePath, 'utf-8');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '文件未找到';
    if (message.includes('ENOENT')) {
      return NextResponse.json({ error: '订阅文件不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
