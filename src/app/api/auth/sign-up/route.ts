import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { signUp } from '@/lib/local-auth-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: '请填写邮箱和密码' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 });
    }

    const result = await signUp(email, password);
    return NextResponse.json({
      session: { access_token: result.sessionToken, user: result.user },
      user: result.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '注册失败';
    const isDuplicate = message.includes('duplicate key') || message.includes('unique');
    return NextResponse.json(
      { error: isDuplicate ? 'User already registered' : message },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
