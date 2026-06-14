import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getUserByToken } from '@/lib/local-auth-server';
import { query } from '@/storage/database/pg-client';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-session') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ banned: false }, { status: 401 });
  }

  try {
    const user = await getUserByToken(token);
    if (!user) {
      return NextResponse.json({ banned: false }, { status: 401 });
    }

    const profile = await query<{ banned: boolean }>(
      'select banned from user_profiles where user_id = $1',
      [user.id]
    );

    return NextResponse.json({ banned: profile.rows[0]?.banned === true });
  } catch {
    return NextResponse.json({ banned: false }, { status: 500 });
  }
}
