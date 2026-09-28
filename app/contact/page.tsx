'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  HelpCircle,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { SITE, telHref } from '@/lib/site-config';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { LeadForm } from '@/components/landing/lead-form';
import { MobileActionBar } from '@/components/landing/contact-actions';
import { Button } from '@/components/ui/button';

const CONTACT_CHANNELS = [
  {
    icon: PhoneCall,
    title: 'Hotline Đặt Hẹn & CSKH',
    value: SITE.phone,
    desc: 'Hỗ trợ tư vấn dịch vụ, kiểm tra phòng trống và đặt hẹn nhanh chóng.',
    actionLabel: 'Gọi ngay',
    actionHref: telHref(SITE.phone),
    badge: 'Trực 09:00 – 20:00',
  },
  {
    icon: MessageCircle,
    title: 'Tư Vấn Zalo Trực Tuyến',
    value: 'Zalo Official Account',
    desc: 'Nhận bảng giá chi tiết, hình ảnh thực tế và tư vấn phác đồ phù hợp.',
    actionLabel: 'Nhắn tin Zalo',
    actionHref: SITE.zalo,
    badge: 'Phản hồi trong 5 phút',
  },
  {
    icon: MapPin,
    title: 'Địa Chỉ Không Gian Spa',
    value: SITE.address,
    desc: 'Tọa lạc tại khu vực trung tâm, thuận tiện di chuyển, có bãi đỗ xe an toàn.',
    actionLabel: 'Xem Google Maps',
    actionHref: SITE.mapUrl,
    badge: 'Có chỗ đỗ ô tô',
  },
];

const FAQS = [
  {
    q: 'Tôi có cần đặt lịch trước khi đến không?',
    a: 'Để đảm bảo phòng riêng tư được chuẩn bị hoa nến chu đáo và kỹ thuật viên tay nghề tốt nhất sẵn sàng phục vụ, Lumière Spa khuyến khích quý khách nên đặt trước tối thiểu 1 - 2 giờ.',
  },
  {
    q: 'Đi ô tô đến spa có chỗ đậu xe an toàn không?',
    a: 'Lumière Spa có bãi đỗ xe ô tô và xe máy rộng rãi ngay trước cửa với bảo vệ túc trực 24/7, hoàn toàn miễn phí cho khách hàng sử dụng dịch vụ.',
  },
  {
    q: 'Nếu có việc bận đột xuất, tôi có thể đổi lịch hoặc hủy không?',
    a: 'Hoàn toàn được. Bạn có thể đổi giờ hoặc hủy lịch hẹn trước tối thiểu 2 giờ mà không mất bất kỳ khoản phí nào qua hotline, Zalo hoặc trực tiếp trên website.',
  },
  {
    q: 'Spa có phòng đôi riêng cho cặp đôi hoặc mẹ con không?',
    a: 'Chúng tôi có các phòng đôi VIP tách biệt hoàn toàn, được trang bị phòng tắm, xông hơi và ánh sáng nến thơm dịu nhẹ, rất thích hợp cho cặp đôi, bạn thân hoặc mẹ con cùng thư giãn.',
  },
];

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-16 sm:pb-0">
      <SiteHeader />

      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-[#EFE5D8] bg-[#FAF6F0] py-12 sm:py-16 lg:py-20">
        {/* Left Botanical Flourish */}
        <div className="pointer-events-none absolute -left-6 top-1/2 -translate-y-1/2 opacity-35 hidden md:block">
          <svg width="220" height="380" viewBox="0 0 220 380" fill="none" stroke="#CBB49C" strokeWidth="1.2">
            <circle cx="80" cy="95" r="7" fill="#E8D7C5" stroke="none" />
            <path d="M-20 250 C50 230 110 160 80 95 C55 50 10 20 -20 10" />
            <path d="M80 95 C120 80 160 115 145 155 C130 190 85 175 75 150" />
            <path d="M40 190 C80 190 95 230 70 255 C45 280 20 255 30 225" />
            <path d="M80 95 Q 105 70 115 90 Q 95 110 80 95 Z" fill="#F4EBE0" fillOpacity="0.4" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-[1240px] px-6">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F5ECE1] px-3.5 py-1 text-xs font-semibold text-[#8D381B] mb-3">
                <Compass className="h-3.5 w-3.5" />
                <span>LIÊN HỆ &amp; ĐẶT HẸN · {SITE.name}</span>
              </div>

              <h1 className="mt-2 font-serif text-3xl sm:text-4xl lg:text-[50px] font-normal leading-[1.16] text-[#20140D]">
                <span className="font-bold">Chúng tôi luôn sẵn sàng</span>
                <br />
                <span className="italic text-[#8D381B]">lắng nghe bạn.</span>
              </h1>

              <p className="mt-4 max-w-xl text-xs sm:text-[14px] leading-relaxed text-[#6B5E55]">
                Một chốn bình yên tách biệt hoàn toàn khỏi nhịp sống ồn ào. Hãy liên hệ với chúng tôi để được tư vấn tận tâm hoặc ghé thăm để cảm nhận sự tĩnh lặng ngay từ bước chân đầu tiên.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[#4F3E34] pt-4 border-t border-[#EFE5D8]">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#8D381B]" />
                  <span>Giờ mở cửa: {SITE.hours}</span>
                </div>
                <span className="h-3 w-[1px] bg-[#D9C8B5] hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-[#8D381B]" />
                  <span>Chỗ đỗ xe an toàn miễn phí</span>
                </div>
              </div>
            </div>

            {/* Right Spa Facade Image */}
            <div className="relative hidden lg:col-span-5 lg:block">
              <div className="relative overflow-hidden rounded-[28px] border border-[#EFE4D6] shadow-[0_16px_40px_rgba(40,20,10,0.08)] bg-[#FAF5EE]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/spa-facade-thumb.jpg"
                  alt="Không gian Lumière Spa"
                  className="h-auto w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Quick Contact Cards */}
      <section className="mx-auto max-w-[1240px] px-6 py-10 lg:py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CONTACT_CHANNELS.map((channel, i) => {
            const Icon = channel.icon;
            return (
              <div
                key={i}
                className="group flex flex-col justify-between rounded-[26px] bg-white p-7 border border-[#EFE5D8] shadow-[0_6px_25px_rgba(40,20,10,0.04)] hover:shadow-[0_14px_36px_rgba(40,20,10,0.08)] hover:-translate-y-1 transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF8F0] border border-[#E9D9C8] text-[#8D381B]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-[#FAF5EE] px-3 py-1 text-[11px] font-semibold text-[#8D381B] border border-[#EFE5D8]">
                      {channel.badge}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-[#20140D] group-hover:text-[#8D381B] transition-colors">
                    {channel.title}
                  </h3>
                  <p className="mt-1 font-mono text-base font-bold text-[#8D381B]">
                    {channel.value}
                  </p>
                  <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-[#6B5E55]">
                    {channel.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#F2EAE0]">
                  <a
                    href={channel.actionHref}
                    target={channel.actionHref.startsWith('http') ? '_blank' : undefined}
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#8D381B] py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#722A13] transition-colors"
                  >
                    <span>{channel.actionLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Form & Location Section */}
      <section className="mx-auto max-w-[1240px] px-6 py-6 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Form: Tư Vấn & Gửi Yêu Cầu */}
          <div className="lg:col-span-6 rounded-[30px] bg-white p-7 sm:p-9 border border-[#EFE5D8] shadow-[0_8px_30px_rgba(40,20,10,0.04)]">
            <div className="mb-6">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9B3E1F]">
                GỬI TIN NHẮN TRỰC TIẾP
              </span>
              <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-[#20140D]">
                Đặt lịch tư vấn miễn phí
              </h2>
              <p className="mt-1.5 text-xs sm:text-[13px] text-[#6B5E55]">
                Chuyên viên tư vấn của Lumière Spa sẽ liên hệ với bạn qua điện thoại hoặc Zalo để phản hồi chi tiết nhất.
              </p>
            </div>

            <LeadForm
              source="contact_page"
              idPrefix="contact"
              luxury={true}
              interest="Chưa biết chọn dịch vụ nào"
            />
          </div>

          {/* Right Column: Visual Atmosphere & Visiting Advice */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            {/* Ambiance Card with Arch Cutout Image */}
            <div className="relative overflow-hidden rounded-[30px] border border-[#EFE5D8] bg-white p-6 sm:p-7 shadow-[0_8px_30px_rgba(40,20,10,0.04)]">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[20px] bg-[#FAF5EE] mb-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/spa-contact-bg.jpg"
                  alt="Không gian thư giãn Lumière Spa"
                  className="h-full w-full object-cover"
                />
              </div>

              <h3 className="font-serif text-xl font-bold text-[#20140D]">
                Lưu ý nhỏ khi ghé thăm <span className="italic text-[#8D381B]">Lumière Spa</span>
              </h3>

              <ul className="mt-4 space-y-3 text-xs sm:text-[13px] text-[#554238]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8D381B] mt-0.5" />
                  <span>
                    <strong>Đến trước 10 – 15 phút:</strong> Để thưởng thức tách trà hoa cúc mật ong ấm nóng và ngâm chân thảo mộc trước khi bắt đầu liệu trình.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8D381B] mt-0.5" />
                  <span>
                    <strong>Tùy chọn kỹ thuật viên:</strong> Bạn hoàn toàn có thể yêu cầu kỹ thuật viên quen thuộc hoặc chỉ định lực tay (nhẹ, vừa, mạnh).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8D381B] mt-0.5" />
                  <span>
                    <strong>Không gian tĩnh lặng:</strong> Spa duy trì âm lượng trò chuyện nhỏ nhẹ và âm nhạc thiền định để tất cả quý khách đều được thư giãn trọn vẹn.
                  </span>
                </li>
              </ul>

              <div className="mt-6 pt-4 border-t border-[#F2EAE0] flex items-center justify-between">
                <span className="text-xs text-[#706359]">Cần đặt phòng riêng cho đoàn?</span>
                <Link
                  href="/booking"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#8D381B] hover:underline"
                >
                  Đặt phòng ngay →
                </Link>
              </div>
            </div>

            {/* Google Maps Location Preview Card */}
            <div className="rounded-[28px] border border-[#EFE5D8] bg-[#FAF5EE] p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9B3E1F]">
                    VỊ TRÍ TRUNG TÂM
                  </span>
                  <h4 className="mt-1 font-serif text-lg font-bold text-[#20140D]">
                    {SITE.name} · {SITE.addressParts.district}
                  </h4>
                  <p className="mt-1 text-xs text-[#6B5E55]">{SITE.address}</p>
                </div>
                <a
                  href={SITE.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#E8DACB] px-3.5 py-2 text-xs font-semibold text-[#8D381B] hover:bg-[#FAF4EC] transition-colors shadow-sm"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Mở bản đồ</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="mx-auto max-w-[1240px] px-6 py-12 lg:py-16">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#9B3E1F]">
            GIẢI ĐÁP THẮC MẮC
          </span>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-[#20140D]">
            Câu hỏi thường gặp <span className="italic text-[#8D381B]">(FAQ)</span>
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-[#EFE5D8] bg-white transition-all shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left font-serif text-base sm:text-lg font-bold text-[#20140D] hover:text-[#8D381B] transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FAF5EE] text-[#8D381B] text-sm">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-[13.5px] leading-relaxed text-[#6B5E55] border-t border-[#F5ECE1]">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Synchronized Site Footer */}
      <SiteFooter />

      <MobileActionBar />
    </div>
  );
}
