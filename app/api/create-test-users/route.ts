import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results = [];

    // Create Admin
    const { data: adminData, error: adminErr } = await supabase.auth.signUp({
      email: 'admin@lumierespa.vn',
      password: 'Lumiere!@#2026Admin'
    });
    if (adminErr) results.push({ msg: 'Admin signup error', error: adminErr.message });
    else {
      // Elevate to admin
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', adminData.user!.id);
      results.push({ msg: 'Admin created', id: adminData.user!.id, updated: !updErr });
    }

    // Clean up session for the next request
    await supabase.auth.signOut();

    // Create Staff
    const { data: staffData, error: staffErr } = await supabase.auth.signUp({
      email: 'lan@lumierespa.vn',
      password: 'Lumiere!@#2026Staff'
    });
    if (staffErr) results.push({ msg: 'Staff signup error', error: staffErr.message });
    else {
      // Get an existing staff ID
      const { data: staffs } = await supabase.from('staff').select('id').limit(1);
      const staffId = staffs?.[0]?.id || null;
      
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ role: 'staff', staff_id: staffId })
        .eq('id', staffData.user!.id);
      results.push({ msg: 'Staff created', id: staffData.user!.id, staff_id: staffId, updated: !updErr });
    }

    await supabase.auth.signOut();

    // Create Customer
    const { data: custData, error: custErr } = await supabase.auth.signUp({
      email: 'khachhang@lumierespa.vn',
      password: 'Lumiere!@#2026Khach'
    });
    if (custErr) results.push({ msg: 'Customer signup error', error: custErr.message });
    else results.push({ msg: 'Customer created', id: custData.user!.id });

    await supabase.auth.signOut();

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
