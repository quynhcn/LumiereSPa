import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SITE } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

function formatReminderText(customerName: string, serviceName: string, startTime: string, bookingCode: string): string {
  const start = new Date(startTime);
  const name = customerName?.trim().split(/\s+/).pop() || 'quý khách';
  return SITE.reminderTemplate
    .replace('{name}', name)
    .replace('{service}', serviceName || 'dịch vụ')
    .replace('{time}', start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))
    .replace('{date}', start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }))
    .replace('{code}', bookingCode);
}

export async function GET(request: Request) {
  return handleReminderRun(request);
}

export async function POST(request: Request) {
  return handleReminderRun(request);
}

async function handleReminderRun(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const specificId = searchParams.get('id');
    const hoursAhead = parseInt(searchParams.get('hours') || '24', 10);

    const now = new Date();
    const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    let query = supabase
      .from('appointments')
      .select('id, start_time, booking_code, customers (id, name, phone), services (id, name), staff (id, name)')
      .in('status', ['pending', 'confirmed'])
      .is('reminded_at', null);

    if (specificId) {
      query = query.eq('id', specificId);
    } else {
      query = query
        .gte('start_time', now.toISOString())
        .lt('start_time', until.toISOString())
        .order('start_time');
    }

    let rows: any[] = [];
    let { data, error } = await query;
    if (error && error.message?.includes('reminded_at')) {
      // Fallback query if column reminded_at doesn't exist yet
      let fallbackQuery = supabase
        .from('appointments')
        .select('id, start_time, booking_code, customers (id, name, phone), services (id, name), staff (id, name)')
        .in('status', ['pending', 'confirmed']);

      if (specificId) {
        fallbackQuery = fallbackQuery.eq('id', specificId);
      } else {
        fallbackQuery = fallbackQuery
          .gte('start_time', now.toISOString())
          .lt('start_time', until.toISOString())
          .order('start_time');
      }
      const res = await fallbackQuery;
      if (res.error) {
        return NextResponse.json({ success: false, error: res.error.message }, { status: 500 });
      }
      rows = res.data || [];
    } else if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } else {
      rows = data || [];
    }

    const appointments = (rows || []) as any[];
    const sentList: any[] = [];
    const timestamp = new Date().toISOString();

    for (const apt of appointments) {
      const custName = apt.customers?.name || 'Khách hàng';
      const custPhone = apt.customers?.phone || '';
      const svcName = apt.services?.name || 'Liệu trình';
      const msg = formatReminderText(custName, svcName, apt.start_time, apt.booking_code);

      // Attempt sending to external gateway if configured in env
      const smsApiUrl = process.env.SMS_API_URL;
      const smsApiKey = process.env.SMS_API_KEY;
      if (smsApiUrl && smsApiKey && custPhone) {
        try {
          await fetch(smsApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${smsApiKey}`,
            },
            body: JSON.stringify({
              to: custPhone.replace(/\D/g, '').replace(/^0/, '84'),
              from: process.env.SMS_BRANDNAME || 'LumiereSpa',
              text: msg,
            }),
          });
        } catch (gatewayErr) {
          console.error('SMS Gateway Error:', gatewayErr);
        }
      }

      // Mark appointment as reminded
      await supabase.from('appointments').update({ reminded_at: timestamp }).eq('id', apt.id);

      sentList.push({
        id: apt.id,
        booking_code: apt.booking_code,
        customer_name: custName,
        phone: custPhone,
        service: svcName,
        start_time: apt.start_time,
        message: msg,
        reminded_at: timestamp,
      });
    }

    return NextResponse.json({
      success: true,
      count: sentList.length,
      timestamp,
      reminded: sentList,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
