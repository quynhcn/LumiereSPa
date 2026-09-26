import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  id: 1,
  first_visit_enabled: true,
  first_visit_discount_pct: 10,
  return_visit_pct: 10,
  return_visit_days: 30,
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ id: 1, ...body, updated_at: new Date().toISOString() })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ...DEFAULT_SETTINGS, ...body, saved_locally: true });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}
