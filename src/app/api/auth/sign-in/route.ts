import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { signIn } from '@/lib/local-auth-server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: '请填写邮箱和密码' }, { status: 400 });
  }

  const result = await signIn(email, password);
  if (!result) {
    return NextResponse.json({ error: 'Invalid login credentials' }, { status: 401 });
  }

  return NextResponse.json({
    session: { access_token: result.sessionToken, user: result.user },
    user: result.user,
  });
}
