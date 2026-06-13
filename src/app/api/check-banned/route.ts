import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/check-banned - Check if the current user is banned
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-session');
  if (!token) {
    return NextResponse.json({ banned: false }, { status: 401 });
  }

  try {
    const client = getSupabaseClient(token);
    const { data: { user }, error: authError } = await client.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ banned: false }, { status: 401 });
    }

    const serviceClient = getSupabaseClient();
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('banned')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({ banned: profile?.banned === true });
  } catch {
    return NextResponse.json({ banned: false }, { status: 500 });
  }
}
