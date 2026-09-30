'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BellRing,
  Check,
  MessageCircle,
  MessageSquareText,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { SITE, telHref, zaloHref } from '@/lib/site-config';
import type { AppointmentWithDetails } from '@/lib/types';
import { Button } from '@/components/ui/button';

type Row = Pick<AppointmentWithDetails, 'id' | 'start_time' | 'booking_code' | 'customers' | 'services' | 'staff'>;

export function reminderText(apt: Row): string {
  const start = new Date(apt.start_time);
  const name = apt.customers?.name?.trim().split(/\s+/).pop() || 'quý khách';
  return SITE.reminderTemplate
    .replace('{name}', name)
    .replace('{service}', apt.services?.name || 'dịch vụ')
    .replace('{time}', start.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }))
    .replace('{date}', start.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }))
    .replace('{code}', apt.booking_code);
}

const VN_OFFSET = 7 * 3600_000;

function endOfTomorrowVN(now: Date) {
  const vn = new Date(now.getTime() + VN_OFFSET);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + 2) - VN_OFFSET);
}

export function ReminderQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const now = new Date();
    const until = endOfTomorrowVN(now);
    const { data } = await supabase
      .from('appointments')
      .select('id, start_time, booking_code, customers (name, phone), services (name), staff (name)')
      .in('status', ['pending', 'confirmed'])
      .is('reminded_at', null)
      .gte('start_time', now.toISOString())
      .lt('start_time', until.toISOString())
      .order('start_time');

    setRows((data || []) as unknown as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markDone = async (id: string) => {
    const timestamp = new Date().toISOString();
    const { error } = await supabase.from('appointments').update({ reminded_at: timestamp }).eq('id', id);
    if (error) {
      toast.error('Không cập nhật được trạng thái');
    } else {
      setRows((r) => r.filter((x) => x.id !== id));
      toast.success('Đã cập nhật trạng thái nhắc hẹn');
    }
  };

  const copyAndOpenZalo = async (apt: Row) => {
    const text = reminderText(apt);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Đã sao chép tin nhắn — dán vào khung chat Zalo');
    } catch {
      toast.message(text);
    }
    window.open(zaloHref(apt.customers?.phone || ''), '_blank', 'noopener');
  };

  return (
    <section className="card-base p-5 sm:p-6">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="block-title flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" /> Nhắc lịch hẹn thủ công (Zalo/SMS)
            {rows.length > 0 ? (
              <span className="rounded-full bg-primary px-2.5 py-0.5 font-sans text-xs font-bold text-primary-foreground">
                {rows.length} cần nhắc
              </span>
            ) : (
              <span className="rounded-full bg-success/15 px-2.5 py-0.5 font-sans text-xs font-semibold text-success">
                Đã hoàn tất
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lịch hẹn hôm nay & ngày mai · Lễ tân gửi thủ công theo đúng MVP
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
      ) : rows.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-foreground">Đã nhắc hết các lịch sắp tới 🎉</p>
          <p className="text-xs text-muted-foreground mt-1">
            Không còn lịch hẹn nào chưa nhắc trong hôm nay và ngày mai.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((apt) => {
            const start = new Date(apt.start_time);
            const phone = apt.customers?.phone || '';
            const todayStr = new Date().toDateString();
            const dateStr = start.toDateString() === todayStr
              ? 'hôm nay'
              : start.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit' });

            return (
              <li key={apt.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/appointments/${apt.id}`} className="font-semibold text-foreground hover:text-primary">
                      {start.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}{' '}
                      {dateStr}
                      {' · '}
                      {apt.customers?.name}
                    </Link>
                    <span className="font-mono text-[11px] text-muted-foreground">({apt.booking_code})</span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground mt-0.5">
                    {apt.services?.name} · {apt.staff?.name} · <span className="font-mono">{phone}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => copyAndOpenZalo(apt)}>
                    <MessageCircle className="mr-1 h-3.5 w-3.5 text-[#0068FF]" /> Sao chép & Zalo
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <a href={`sms:${phone.replace(/\s/g, '')}?body=${encodeURIComponent(reminderText(apt))}`}>
                      <MessageSquareText className="mr-1 h-3.5 w-3.5" /> Gửi SMS
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <a href={telHref(phone)}>
                      <Phone className="mr-1 h-3.5 w-3.5" /> Gọi
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 bg-success/15 text-success hover:bg-success/25 border border-success/30"
                    onClick={() => markDone(apt.id)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Xác nhận đã nhắc
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
