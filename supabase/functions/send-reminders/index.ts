/**
 * Automatic appointment reminders (Supabase Edge Function, Deno) — OPTIONAL.
 *
 * Today reminders are sent by hand from the admin dashboard ("Cần nhắc lịch").
 * When a provider account is ready, deploy this function and schedule it every 15 minutes:
 *
 *   supabase functions deploy send-reminders
 *   supabase secrets set REMINDER_PROVIDER=zns ZNS_ACCESS_TOKEN=... ZNS_TEMPLATE_ID=...
 *   # or: REMINDER_PROVIDER=sms SMS_API_URL=... SMS_API_KEY=... SMS_BRANDNAME=...
 *   -- then in SQL (pg_cron + pg_net):
 *   select cron.schedule('send-reminders', '*/15 * * * *',
 *     $$ select net.http_post(url := '<project-url>/functions/v1/send-reminders',
 *        headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>')) $$);
 *
 * It picks confirmed/pending appointments starting in 1h45–2h15 that were not reminded yet,
 * sends one message each and sets appointments.reminded_at (so the manual queue skips them too).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Apt = {
  id: string;
  start_time: string;
  booking_code: string;
  customers: { name: string; phone: string } | null;
  services: { name: string } | null;
};

const env = (k: string) => Deno.env.get(k) ?? '';

function vnTime(iso: string) {
  const d = new Date(iso);
  return {
    time: d.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }),
  };
}

/** Normalise to 84xxxxxxxxx (format both ZNS and most VN SMS gateways expect). */
const intlPhone = (p: string) => p.replace(/\D/g, '').replace(/^0/, '84');

async function sendZns(apt: Apt): Promise<boolean> {
  const { time, date } = vnTime(apt.start_time);
  const res = await fetch('https://business.openapi.zalo.me/message/template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', access_token: env('ZNS_ACCESS_TOKEN') },
    body: JSON.stringify({
      phone: intlPhone(apt.customers!.phone),
      template_id: env('ZNS_TEMPLATE_ID'),
      // Parameter names must match the template approved in Zalo Cloud Account
      template_data: { customer_name: apt.customers!.name, service: apt.services?.name ?? '', time, date, code: apt.booking_code },
      tracking_id: apt.id,
    }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok && body.error === 0;
}

async function sendSms(apt: Apt): Promise<boolean> {
  const { time, date } = vnTime(apt.start_time);
  const text = `Lumiere Spa nhac lich ${apt.services?.name ?? ''} luc ${time} ngay ${date}. Ma ${apt.booking_code}.`;
  // Generic JSON gateway — adapt field names to your provider (eSMS, SpeedSMS, …)
  const res = await fetch(env('SMS_API_URL'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('SMS_API_KEY')}` },
    body: JSON.stringify({ to: intlPhone(apt.customers!.phone), from: env('SMS_BRANDNAME'), text }),
  });
  return res.ok;
}

Deno.serve(async () => {
  const provider = env('REMINDER_PROVIDER'); // 'zns' | 'sms'
  if (!provider) return new Response(JSON.stringify({ skipped: 'REMINDER_PROVIDER not set' }), { status: 200 });

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const now = Date.now();
  const { data, error } = await db
    .from('appointments')
    .select('id, start_time, booking_code, customers (name, phone), services (name)')
    .in('status', ['pending', 'confirmed'])
    .is('reminded_at', null)
    .gte('start_time', new Date(now + 105 * 60_000).toISOString())
    .lt('start_time', new Date(now + 135 * 60_000).toISOString());
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0;
  for (const apt of (data ?? []) as unknown as Apt[]) {
    if (!apt.customers?.phone) continue;
    const ok = provider === 'zns' ? await sendZns(apt) : await sendSms(apt);
    if (ok) {
      await db.from('appointments').update({ reminded_at: new Date().toISOString() }).eq('id', apt.id);
      sent++;
    }
  }
  return new Response(JSON.stringify({ checked: data?.length ?? 0, sent }), { headers: { 'Content-Type': 'application/json' } });
});
