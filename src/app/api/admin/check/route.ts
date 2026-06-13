import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-helper';

export async function GET(req: NextRequest) {
  const { user, isAdmin, error, status } = await getAdminUser(req);

  if (!user) {
    return NextResponse.json({ isAdmin: false, error }, { status });
  }

  return NextResponse.json({
    isAdmin,
    email: user.email ?? null,
    userId: user.id,
  });
}
