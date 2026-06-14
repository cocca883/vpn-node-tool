import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { signOut } from '@/lib/local-auth-server';

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (token) {
    await signOut(token);
  }

  return NextResponse.json({ success: true });
}
