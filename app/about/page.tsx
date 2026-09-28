'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Coffee,
  Droplets,
  Ear,
  Eye,
  Heart,
  Leaf,
  MapPin,
  Music,
  Quote,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { SITE, telHref } from '@/lib/site-config';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Logo } from '@/components/logo';
import { LeadDialog } from '@/components/landing/lead-form';
import { MobileActionBar } from '@/components/landing/contact-actions';
import { Button } from '@/components/ui/button';

// 5 Senses Therapy Concept
const SENSES = [
  {
    icon: Leaf,
    title: 'Khứu giác · Hương thảo mộc ấm',
    desc: 'Hương thơm từ sả chanh tươi, quế chi, vỏ bưởi và hoa hồi nấu thủ công mỗi sớm mai lan tỏa dịu nhẹ, xoa dịu căng thẳng thần kinh ngay khi bạn vừa bước qua cánh cửa.',
    tag: 'Thảo mộc nấu tươi',
  },
  {
    icon: Music,
    title: 'Thính giác · Âm hưởng thiền an yên',
    desc: 'Thanh âm chuông xoay Tây Tạng kết hợp cùng âm nhạc sóng não thiền định 432Hz giúp tĩnh tâm, đưa cơ thể và não bộ chìm sâu vào trạng thái thư giãn tuyệt đối.',
    tag: 'Tần số 432Hz',
  },
  {
    icon: Eye,
    title: 'Thị giác · Tĩnh tại & Mộc mạc',
    desc: 'Tông màu gỗ mộc trầm ấm, ánh sáng vàng 2700K dịu nhẹ cho mắt cùng những chậu cây xanh tươi mát tạo nên cảm giác bình yên như một chốn trú ẩn quen thuộc.',
    tag: 'Ánh sáng êm dịu',
  },
  {
    icon: Droplets,
    title: 'Xúc giác · Đôi tay ấm & Dầu ép lạnh',
    desc: 'Đôi bàn tay ấm nóng của kỹ thuật viên lành nghề với lực miết bấm huyệt chuẩn xác, kết hợp tinh dầu thực vật ép lạnh và khăn bông cotton hấp tiệt trùng 100°C.',
    tag: 'Dầu thực vật ép lạnh',
  },
  {
    icon: Coffee,
    title: 'Vị giác · Trà thảo mộc & Chè dưỡng nhan',
    desc: 'Tách trà hoa cúc ấm khai vị lúc mới đến để thanh lọc cơ thể, và chén chè dưỡng nhan thảo mộc thanh mát bồi bổ khí huyết sau khi kết thúc liệu trình.',
    tag: 'Thanh lọc cơ thể',
  },
];

// Core 3-No Commitment
const THREE_NO_COMMITMENTS = [
  {
    title: 'Tuyệt đối không nhận Tip',
    subtitle: 'Thư giãn trọn vẹn, không bận tâm',
    desc: 'Đội ngũ kỹ thuật viên tại Lumière Spa được đảm bảo chế độ đãi ngộ xứng đáng và trân trọng. Khách hàng hoàn toàn yên tâm nghỉ ngơi mà không phải băn khoăn về chi phí bồi dưỡng.',
  },
  {
    title: 'Không chèo kéo / ép mua gói',
    subtitle: 'Tôn trọng sự tự nhiên của khách hàng',
    desc: 'Tuyệt đối không có áp lực doanh số hay tư vấn mua thẻ dồn dập trong lúc trị liệu. Chúng tôi chỉ lắng nghe và đưa ra gợi ý khi bạn thực sự có nhu cầu.',
  },
  {
    title: 'Không phát sinh chi phí ẩn',
    subtitle: 'Giá niêm yết rõ ràng, minh bạch',
    desc: 'Giá dịch vụ được công khai minh bạch. Toàn bộ trà bánh đón tiếp, nước ngâm chân thảo dược, khăn hấp và đồ dùng cá nhân đều được phục vụ miễn phí.',
  },
];

// 4-Step Guest Journey
const EXPERIENCE_STEPS = [
  {
    step: '01',
    title: 'Thưởng trà & Lắng nghe',
    desc: 'Nhâm nhi tách trà thảo mộc ấm. Kỹ thuật viên lắng nghe những điểm đau mỏi trên cơ thể bạn để điều chỉnh lực tay và dòng tinh dầu phù hợp nhất.',
  },
  {
    step: '02',
    title: 'Ngâm chân đá muối dược liệu',
    desc: 'Ngâm chân nước ấm thảo mộc cổ truyền kết hợp đá muối Himalaya giúp kích hoạt huyệt đạo bàn chân, giải tỏa căng cứng và lưu thông khí huyết.',
  },
  {
    step: '03',
    title: 'Trị liệu bấm huyệt chuyên sâu',
    desc: 'Đôi bàn tay nghệ nhân thực hiện các kỹ thuật miết, day ấn huyệt chuẩn xác, kết hợp túi chườm thảo dược ấm giải phóng triệt để các bó cơ co thắt.',
  },
  {
    step: '04',
    title: 'Thức giấc & Chè dưỡng nhan',
    desc: 'Tỉnh giấc êm ái trong tiếng chuông xoay ngân vang. Thưởng thức chén chè dưỡng nhan ngọt thanh để bồi bổ và nạp lại năng lượng trọn vẹn.',
  },
];

// Space Gallery
const SPACES = [
  {
    title: 'Phòng trị liệu đôi ấm cúng',
    desc: 'Thiết kế riêng cho cặp đôi, mẹ con hoặc bạn thân cùng chia sẻ khoảng thời gian thư thái bên nhau.',
    img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80',
  },
  {
    title: 'Phòng đơn VIP tĩnh lặng',
    desc: 'Không gian tách biệt tuyệt đối, rèm che kín đáo cùng ánh sáng dịu nhẹ để bạn tận hưởng sự yên ả của riêng mình.',
    img: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&auto=format&fit=crop&q=80',
  },
  {
    title: 'Khu gội đầu dưỡng sinh thảo dược',
    desc: 'Giường gội bọc da êm ái kết hợp vòm nước tuần hoàn và nước thảo dược nấu tươi ấm nóng mỗi ngày.',
    img: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop&q=80',
  },
  {
    title: 'Khu vực ngâm chân & Thưởng trà',
    desc: 'Góc ngồi thanh nhã ngập tràn ánh sáng tự nhiên và cây xanh, nơi bạn nhâm nhi tách trà hoa cúc ấm trước buổi hẹn.',
    img: 'https://images.unsplash.com/photo-1512290900672-1f486ff54cf5?w=800&auto=format&fit=crop&q=80',
  },
];

// Strict Organic & Hygiene Standards
const HYGIENE_STANDARDS = [
  {
    title: '100% Thảo dược tự nhiên tuyển chọn',
    desc: 'Gừng già, ngải cứu, quế chi, hoa hồi và vỏ bưởi được thu hoạch từ các vùng trồng dược liệu sạch, giữ trọn vẹn tinh chất quý giá.',
  },
  {
    title: 'Dầu thực vật ép lạnh cao cấp',
    desc: 'Sử dụng dầu Jojoba, dầu Hạnh nhân ngọt và dầu Dừa tinh khiết. Nói KHÔNG với Mineral Oil (dầu khoáng nhân tạo gây bít tắc lỗ chân lông).',
  },
  {
    title: 'Khăn bông hấp tiệt trùng 100°C',
    desc: 'Mỗi lượt khách sử dụng một bộ khăn, ga trải và áo choàng riêng biệt, được giặt sấy nhiệt độ cao và hấp tiệt trùng vô khuẩn trước khi phục vụ.',
  },
  {
    title: 'Không gian thanh lọc liên tục',
    desc: 'Máy xông tinh dầu tự nhiên hoạt động định kỳ, kết hợp lọc không khí và khử khuẩn phòng trị liệu sau mỗi buổi hẹn.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      <SiteHeader />

      {/* Hero: Brand Story & Philosophy */}
      <section className="relative overflow-hidden bg-[#FAF6F0] pt-12 pb-20 sm:pt-16 sm:pb-28 border-b border-[#EAE0D3]/70">
        {/* Soft botanical branch shadows on left */}
        <div className="pointer-events-none absolute -left-12 top-0 h-96 w-96 opacity-30 select-none">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
            <path d="M0 40C40 60 70 100 90 150" stroke="#7A685B" strokeWidth="2" strokeLinecap="round" />
            <path d="M30 55C45 40 65 42 75 55C65 65 45 68 30 55Z" fill="#7A685B" fillOpacity="0.15" />
            <path d="M50 78C70 65 90 70 98 85C85 92 68 90 50 78Z" fill="#7A685B" fillOpacity="0.15" />
            <path d="M70 110C95 100 115 110 120 125C105 132 85 125 70 110Z" fill="#7A685B" fillOpacity="0.15" />
          </svg>
        </div>

        {/* Delicate archway shadow & leaf accents on top right */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-80 w-80 opacity-35 select-none">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
            <path d="M200 10C150 10 110 50 110 100C110 150 150 190 200 190" stroke="#8D381B" strokeWidth="1.2" strokeDasharray="4 4" />
            <path d="M160 40C140 25 120 30 115 45C130 55 150 50 160 40Z" fill="#4B6B46" fillOpacity="0.25" />
            <path d="M140 70C120 60 105 70 105 85C120 90 135 85 140 70Z" fill="#4B6B46" fillOpacity="0.25" />
          </svg>
        </div>

        {/* Sculpted stone contour overlay at bottom edge */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#F4EEE5]/80 to-transparent" />

        <div className="relative z-10 mx-auto max-w-[1360px] px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Left Column: Brand Story & Values */}
            <div className="lg:col-span-6 xl:col-span-6">
              {/* Eyebrow */}
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-[#C49A62]" />
                <span className="text-xs font-semibold tracking-[0.2em] text-[#8D381B] uppercase">
                  CÂU CHUYỆN THƯƠNG HIỆU · LUMIÈRE SPA
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="mt-4 font-serif text-4xl sm:text-5xl lg:text-[54px] font-normal leading-[1.18] text-[#20140D]">
                Nơi thời gian dừng lại,<br />
                <span className="font-serif italic text-[#8D381B]">
                  để bạn yêu thương<br />chính mình.
                </span>
                <span className="inline-block ml-3 align-middle text-[#8D381B]">
                  <svg width="34" height="24" viewBox="0 0 34 24" fill="none" className="inline-block">
                    <path d="M2 18C10 18 16 12 22 6C26 2 30 4 32 8C34 12 30 16 24 16C18 16 14 20 20 22" stroke="#8D381B" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              {/* Story Paragraphs */}
              <p className="mt-6 text-sm sm:text-base leading-relaxed text-[#5A4B41] font-light">
                Trong tiếng Pháp, <strong className="font-semibold text-[#20140D]">Lumière</strong> mang ý nghĩa là <em>Ánh Sáng</em>. Chúng tôi tin rằng khi cơ thể được nghỉ ngơi sâu và tâm trí được trút bỏ muộn phiền, năng lượng tích cực và vẻ rạng ngời tự nhiên từ bên trong bạn sẽ bừng sáng.
              </p>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#5A4B41] font-light">
                Sinh ra từ tình yêu dành cho thảo dược truyền thống Việt Nam và mong muốn kiến tạo một không gian tĩnh lặng giữa nhịp sống đô thị, Lumière Spa là nơi bạn có thể trút bỏ mọi áp lực, thả lỏng từng thớ cơ và trao gửi thân tâm cho đôi bàn tay của những người nghệ nhân lành nghề.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/booking"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-[#8D381B] px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#8D381B]/20 transition-all duration-300 hover:bg-[#772F16] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Đặt lịch trải nghiệm</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center justify-center rounded-full border border-[#D8C7B8] bg-[#FAF6F0] px-6 py-3.5 text-sm font-semibold text-[#5A4B41] transition-all duration-300 hover:border-[#8D381B] hover:text-[#8D381B] hover:bg-white"
                >
                  Khám phá các liệu trình
                </Link>
              </div>

              {/* Bottom Stats Bar */}
              <div className="mt-12 flex flex-wrap items-center gap-6 sm:gap-8 border-t border-[#EAE0D3]/80 pt-6">
                {/* Stat 1 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <strong className="block font-serif text-xl sm:text-2xl font-medium text-[#20140D]">5.000+</strong>
                    <span className="text-xs text-[#8A796D]">Khách hàng yêu quý</span>
                  </div>
                </div>
                <div className="hidden h-8 w-px bg-[#EAE0D3] sm:block" />

                {/* Stat 2 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                    <Star className="h-4 w-4 fill-[#8D381B] text-[#8D381B]" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1 font-serif text-xl sm:text-2xl font-medium text-[#20140D]">
                      <span>4.9</span>
                      <span className="text-xs text-[#8D381B]">★</span>
                    </div>
                    <span className="text-xs text-[#8A796D]">Từ 1200+ đánh giá</span>
                  </div>
                </div>
                <div className="hidden h-8 w-px bg-[#EAE0D3] sm:block" />

                {/* Stat 3 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                    <Leaf className="h-4 w-4" />
                  </span>
                  <div>
                    <strong className="block font-serif text-xl sm:text-2xl font-medium text-[#20140D]">100%</strong>
                    <span className="text-xs text-[#8A796D]">Thảo mộc tự nhiên</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Collage with Treatment Photo & Quote */}
            <div className="relative mx-auto w-full max-w-lg lg:col-span-6 lg:max-w-none">
              <div className="relative aspect-[4/3] sm:aspect-[14/11] overflow-hidden rounded-[32px] sm:rounded-[40px] border border-[#EBE3D7] shadow-[0_20px_50px_rgba(40,20,10,0.12)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/about-hero-stone.jpg"
                  alt="Trị liệu đá nóng thư giãn chuyên sâu tại Lumière Spa"
                  className="h-full w-full object-cover"
                />

                {/* Top-left decorative badge */}
                <div className="absolute left-6 top-6 rounded-full border border-white/40 bg-black/25 px-4 py-2 text-[10px] sm:text-xs font-medium uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
                  Natural Healing · Beauty Within
                </div>
              </div>

              {/* Floating Testimonial Quote Card (bottom right overlap) */}
              <div className="relative -mt-14 sm:-mt-20 ml-auto mr-2 sm:mr-4 max-w-[340px] sm:max-w-[370px] rounded-[24px] border border-[#E8DFD3] bg-[#FDFBF7]/95 p-5 sm:p-6 shadow-[0_16px_40px_rgba(30,19,13,0.1)] backdrop-blur-md">
                <Quote className="h-6 w-6 text-[#C49A62]" />
                <p className="mt-2 font-serif text-sm sm:text-base leading-relaxed text-[#20140D] italic">
                  &ldquo;Đến Lumière, gác lại vội vàng. Thư giãn không phải là sự xa xỉ, mà là điều cơ thể bạn xứng đáng nhận được.&rdquo;
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-[#EAE0D3]/80 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8D381B]">
                    Đội ngũ nghệ nhân Lumière Spa
                  </span>
                  <span className="text-[#C49A62]">
                    <Leaf className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy: Hồn Lumière trong từng chi tiết nhỏ */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Hồn Lumière · Trong từng chi tiết nhỏ</span>
            <h2 className="section-heading mt-3">Một khoảng dừng chân an yên giữa phố thị.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Ở Lumière Spa, chúng tôi không xem việc chăm sóc cơ thể chỉ là một dịch vụ thông thường. Đó là một nghi thức chữa lành tinh tế, nơi từng ngọn nến ấm, tách trà hoa, tấm khăn bông tiệt trùng cho đến kỹ thuật day ấn huyệt đều được chăm chút bằng tất cả tấm lòng.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="card-base flex flex-col p-8 transition-all hover:shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
                <Sparkles className="h-6 w-6" />
              </span>
              <h3 className="font-serif text-2xl font-semibold text-foreground">Không gian tĩnh tại</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Tách biệt hoàn toàn khỏi tiếng còi xe và nhịp sống hối hả. Không gian tại Lumière Spa được thiết kế mộc mạc với ánh sáng vàng êm ái, mang lại cảm giác bình yên như bạn vừa trở về ngôi nhà của chính mình.
              </p>
            </div>

            <div className="card-base flex flex-col p-8 transition-all hover:shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
                <Leaf className="h-6 w-6" />
              </span>
              <h3 className="font-serif text-2xl font-semibold text-foreground">Dược liệu thuần khiết</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Chúng tôi tin vào sức mạnh chữa lành nguyên bản từ mẹ thiên nhiên. 100% thảo mộc được thu hái tươi mới và tinh dầu thực vật ép lạnh, không chứa hương liệu hóa học hay chất bảo quản độc hại.
              </p>
            </div>

            <div className="card-base flex flex-col p-8 transition-all hover:shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
                <Heart className="h-6 w-6" />
              </span>
              <h3 className="font-serif text-2xl font-semibold text-foreground">Đôi bàn tay thấu cảm</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Kỹ thuật viên tại Lumière không chỉ thành thạo xoa bóp bấm huyệt Đông y mà còn phục vụ bằng sự thấu hiểu. Chúng tôi lắng nghe nhịp thở của bạn, tôn trọng sự tĩnh lặng và điều chỉnh lực ấn êm ái nhất.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Highlight: The 5-Senses Therapy */}
      <section className="border-y border-border bg-[hsl(var(--cream-soft))] py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Trải nghiệm độc bản</span>
            <h2 className="section-heading mt-3">Hành Trình Ngũ Quan Dưỡng Sinh.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Khi bước qua ngưỡng cửa Lumière Spa, cả 5 giác quan của bạn sẽ được đánh thức và nâng niu một cách dịu dàng nhất.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SENSES.map((sense, idx) => {
              const Icon = sense.icon;
              return (
                <div
                  key={idx}
                  className={`card-base flex flex-col p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl ${
                    idx === 4 ? 'sm:col-span-2 lg:col-span-1' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground">
                      {sense.tag}
                    </span>
                  </div>
                  <h3 className="mt-6 font-serif text-xl font-semibold text-foreground">
                    {sense.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{sense.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Cam kết "3 Không" Minh Bạch */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Sự an tâm tuyệt đối</span>
            <h2 className="section-heading mt-3">Cam kết &ldquo;3 Không&rdquo; tại Lumière Spa.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Chúng tôi bảo vệ trọn vẹn khoảng thời gian nghỉ ngơi của bạn bằng những nguyên tắc dịch vụ minh bạch nhất.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {THREE_NO_COMMITMENTS.map((item, i) => (
              <div
                key={i}
                className="relative flex flex-col rounded-3xl border border-border bg-card p-8 shadow-sm transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">{item.subtitle}</span>
                <h3 className="mt-2 font-serif text-2xl font-bold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4-Step Guest Journey */}
      <section className="border-y border-border bg-[hsl(var(--cream-soft))] py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Quy trình đón tiếp chu đáo</span>
            <h2 className="section-heading mt-3">Đến Lumière, gác lại vội vàng.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Mỗi buổi hẹn được thiết kế như một hành trình khép kín, đưa bạn từ trạng thái căng thẳng về sự an yên trọn vẹn.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {EXPERIENCE_STEPS.map((step) => (
              <div key={step.step} className="rounded-2xl border border-border bg-card p-7 shadow-sm">
                <span className="font-serif text-3xl font-bold text-accent">{step.step}</span>
                <h3 className="mt-4 font-serif text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Strict Organic & Hygiene Standards */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="eyebrow">Tiêu chuẩn chuẩn mực</span>
              <h2 className="section-heading mt-3">Nguyên liệu thuần khiết &amp; Vô trùng y tế.</h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Sức khỏe và làn da của khách hàng là ưu tiên cao nhất. Mọi giọt tinh dầu tiếp xúc với cơ thể bạn hay từng tấm khăn đều phải đáp ứng những tiêu chuẩn vệ sinh nghiêm ngặt nhất.
              </p>

              <div className="mt-8 space-y-5">
                {HYGIENE_STANDARDS.map((std, idx) => (
                  <div key={idx} className="flex gap-4">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">{std.title}</h4>
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{std.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border shadow-xl sm:aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=900&auto=format&fit=crop&q=80"
                  alt="Chuẩn mực nguyên liệu thảo mộc tại Lumière Spa"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/95 p-4 backdrop-blur-md dark:bg-black/85">
                  <p className="font-serif text-lg font-medium text-foreground">
                    An toàn tuyệt đối cho mọi làn da nhạy cảm
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    100% tinh dầu thực vật ép lạnh · Không dầu khoáng (Mineral oil)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spa Spaces Gallery */}
      <section className="border-t border-border bg-[hsl(var(--cream-soft))] py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-12">
            <div>
              <span className="eyebrow">Không gian Lumière Spa</span>
              <h2 className="section-heading mt-2">Chốn tĩnh lặng giữa lòng đô thị.</h2>
            </div>
            <Link href="/services" className="font-semibold text-primary hover:underline text-sm">
              Khám phá toàn bộ dịch vụ →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {SPACES.map((space, i) => (
              <div
                key={i}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-xl"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={space.img}
                    alt={space.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-70" />
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-lg font-semibold text-foreground">{space.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{space.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 lg:py-24 bg-background">
        <div className="mx-auto max-w-[1000px] px-6">
          <div className="relative overflow-hidden rounded-3xl bg-[hsl(var(--deep-footer))] px-8 py-14 text-center text-white sm:px-14 sm:py-16 shadow-2xl">
            <Sparkles className="mx-auto h-10 w-10 text-[hsl(var(--gold-light))] mb-4 opacity-90" />
            <h2 className="font-serif text-3xl font-medium sm:text-4xl lg:text-5xl text-white">
              Hôm nay, hãy để Lumière chăm sóc bạn.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm sm:text-base text-white/80 leading-relaxed">
              Đặt lịch online ngay để tận hưởng ưu đãi <strong>giảm 10% cho lần trải nghiệm đầu tiên</strong>. Lịch hẹn được xác nhận tức thì, không cần thanh toán trước.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/booking" className="btn-primary h-12 px-7 text-sm font-bold shadow-lg">
                Đặt lịch hẹn ngay <ArrowRight className="h-4 w-4" />
              </Link>
              <LeadDialog source="about_cta" interest="Tư vấn trải nghiệm">
                <Button size="lg" variant="outline" className="h-12 px-7 border-white/30 text-white hover:bg-white/10 font-semibold">
                  Để lại SĐT tư vấn
                </Button>
              </LeadDialog>
            </div>
            <p className="mt-6 text-xs text-white/60">
              Hotline hỗ trợ: <a href={telHref(SITE.phone)} className="underline hover:text-white">{SITE.phone}</a> · Mở cửa {SITE.hours}
            </p>
          </div>
        </div>
      </section>

      {/* Synchronized Site Footer */}
      <SiteFooter />

      <MobileActionBar />
    </div>
  );
}
