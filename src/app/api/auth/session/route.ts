import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getUserByToken } from '@/lib/local-auth-server';

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return NextResponse.json({ session: null, user: null });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return NextResponse.json({ session: null, user: null });
  }

  return NextResponse.json({
    session: { access_token: token, user },
    user,
  });
}
