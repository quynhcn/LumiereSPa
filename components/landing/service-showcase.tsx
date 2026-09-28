'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Flower2, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ServiceShowcaseItem {
  id: string;
  name: string;
  badge?: string;
  description: string;
  duration: string;
  feature?: string;
  image: string;
  bookingUrl: string;
  detailUrl: string;
  iconType: 'lotus' | 'leaf';
}

const SERVICES: ServiceShowcaseItem[] = [
  {
    id: 'body',
    name: 'Chăm sóc cơ thể',
    description: 'Thư giãn sâu, nuôi dưỡng làn da mịn màng từ thiên nhiên.',
    duration: '60 – 90 phút',
    image: '/service-body.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'lotus',
  },
  {
    id: 'facial',
    name: 'Chăm sóc da mặt',
    description: 'Làn da rạng rỡ, khỏe mạnh từ những liệu pháp tinh túy.',
    duration: '60 – 75 phút',
    image: '/service-facial.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'lotus',
  },
  {
    id: 'headspa',
    name: 'Gội đầu dưỡng sinh',
    badge: '★ ĐƯỢC YÊU THÍCH',
    description: 'Thư giãn tâm trí, tái tạo năng lượng với thảo mộc thiên nhiên.',
    duration: '45 – 60 phút',
    feature: 'Thảo mộc thuần khiết',
    image: '/service-headspa.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'leaf',
  },
  {
    id: 'neck',
    name: 'Massage cổ vai gáy',
    description: 'Giải tỏa căng thẳng, phục hồi năng lượng cuộc sống.',
    duration: '60 phút',
    image: '/service-neck.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'leaf',
  },
  {
    id: 'special',
    name: 'Liệu trình đặc biệt',
    description: 'Trải nghiệm chăm sóc toàn diện dành riêng cho bạn.',
    duration: 'Liệu trình cá nhân hóa',
    image: '/service-special.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'lotus',
  },
];

export function ServiceShowcase() {
  // Gội đầu dưỡng sinh (index 2) is active/center by default
  const [activeIdx, setActiveIdx] = useState(2);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const total = SERVICES.length;

  const handlePrev = () => {
    setActiveIdx((prev) => (prev - 1 + total) % total);
  };

  const handleNext = () => {
    setActiveIdx((prev) => (prev + 1) % total);
  };

  // Touch Swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (diff > 40) handlePrev();
    if (diff < -40) handleNext();
    setTouchStartX(null);
  };

  // 5 slots around activeIdx: -2 (far left), -1 (mid left), 0 (center), 1 (mid right), 2 (far right)
  const slots = [-2, -1, 0, 1, 2].map((offset) => {
    const itemIndex = (activeIdx + offset + total) % total;
    return {
      offset,
      itemIndex,
      item: SERVICES[itemIndex],
    };
  });

  return (
    <section
      id="dich-vu"
      className="relative scroll-mt-20 overflow-hidden bg-[#FAF6F0] py-20 lg:py-28 select-none"
    >
      {/* Top Left: Sunlit Palm Frond Shadow Silhouette */}
      <div className="pointer-events-none absolute -left-12 -top-12 h-96 w-96 opacity-15">
        <svg viewBox="0 0 200 200" fill="#3A2C21" className="h-full w-full blur-[1px]">
          <path d="M0,0 C40,70 90,120 180,140 C140,110 110,80 80,40 C60,20 30,10 0,0 Z" />
          <path d="M20,0 C60,60 110,100 190,110 C150,90 120,60 90,30 Z" />
          <path d="M0,30 C50,80 90,140 160,180 C120,140 90,100 60,60 Z" />
        </svg>
      </div>

      {/* Top Right: Elegant Golden Filigree Lines */}
      <div className="pointer-events-none absolute top-4 right-4 h-56 w-56 opacity-20 text-[#A27854] hidden lg:block">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.8">
          <circle cx="90" cy="10" r="70" strokeDasharray="3 3" />
          <path d="M30,10 C50,30 70,60 95,95" />
          <path d="M45,10 C65,30 80,55 95,80" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Section Header matching mockup */}
        <div className="text-center max-w-2xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 justify-center">
            <span className="h-[1px] w-8 sm:w-14 bg-[#8D381B]/40" />
            <Flower2 className="h-4 w-4 text-[#8D381B]" />
            <span className="text-xs sm:text-[13px] font-bold tracking-[0.25em] text-[#8D381B] uppercase">
              LUMIÈRE SPA
            </span>
            <span className="h-[1px] w-8 sm:w-14 bg-[#8D381B]/40" />
          </div>

          {/* Heading */}
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-[48px] font-medium leading-[1.15] tracking-[-0.02em] text-[#1F1A17]">
            Chọn dịch vụ phù hợp cho bạn
          </h2>

          {/* Subtitle */}
          <p className="mt-3.5 text-[15px] sm:text-[16px] leading-[1.75] text-[#6B5F54]">
            Mỗi liệu trình tại Lumière Spa được thiết kế để nuôi dưỡng vẻ đẹp tự nhiên, giúp bạn cân bằng thân – tâm – trí.
          </p>
        </div>

        {/* 5-Card Circular Carousel Stage */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative mt-12 sm:mt-16 w-full flex items-center justify-center min-h-[580px] sm:min-h-[620px]"
        >
          {/* Navigation Button: Prev (<) */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Dịch vụ trước"
            className="absolute left-1 sm:left-3 xl:left-4 top-1/2 -translate-y-1/2 z-40 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/95 text-[#1F1A17] shadow-[0_8px_25px_rgba(40,25,15,0.18)] ring-1 ring-black/5 transition-all hover:bg-white hover:scale-110 active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.2]" />
          </button>

          {/* Navigation Button: Next (>) */}
          <button
            type="button"
            onClick={handleNext}
            aria-label="Dịch vụ tiếp theo"
            className="absolute right-1 sm:right-3 xl:right-4 top-1/2 -translate-y-1/2 z-40 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/95 text-[#1F1A17] shadow-[0_8px_25px_rgba(40,25,15,0.18)] ring-1 ring-black/5 transition-all hover:bg-white hover:scale-110 active:scale-95 cursor-pointer"
          >
            <ChevronRight className="h-6 w-6 stroke-[2.2]" />
          </button>

          {/* 5 Cards Row Container */}
          <div className="w-full flex items-center justify-center gap-3 sm:gap-4 xl:gap-5">
            {slots.map(({ offset, itemIndex, item }) => {
              const isCenter = offset === 0;
              const isFlanking = Math.abs(offset) === 1;
              const isOuter = Math.abs(offset) === 2;

              return (
                <div
                  key={`${item.id}-${offset}`}
                  onClick={() => setActiveIdx(itemIndex)}
                  className={cn(
                    'relative rounded-[28px] overflow-hidden flex flex-col cursor-pointer transition-all duration-500 ease-out select-none',
                    // Responsive visibility: Center always, flanking on sm+, outer on lg+
                    isOuter ? 'hidden lg:flex' : isFlanking ? 'hidden sm:flex' : 'flex',
                    // Dimensions & hierarchy
                    isCenter
                      ? 'w-[300px] sm:w-[310px] xl:w-[325px] h-[560px] sm:h-[590px] z-30 bg-white ring-2 ring-[#8D381B]/25 shadow-[0_30px_70px_rgba(40,25,15,0.22)] -translate-y-2 sm:-translate-y-3'
                      : isFlanking
                        ? 'w-[250px] sm:w-[260px] xl:w-[275px] h-[490px] sm:h-[515px] z-20 bg-[#FFFDF9] ring-1 ring-black/5 shadow-[0_12px_35px_rgba(40,25,15,0.08)] opacity-95 hover:opacity-100'
                        : 'w-[220px] sm:w-[235px] xl:w-[250px] h-[450px] sm:h-[475px] z-10 bg-[#FFFDF9] ring-1 ring-black/5 shadow-[0_8px_25px_rgba(40,25,15,0.05)] opacity-80 hover:opacity-100'
                  )}
                >
                  {/* Photo with Overlay */}
                  <div
                    className={cn(
                      'relative w-full overflow-hidden shrink-0 transition-all',
                      isCenter ? 'h-[360px] sm:h-[390px]' : isFlanking ? 'h-[320px] sm:h-[345px]' : 'h-[290px] sm:h-[315px]'
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    />

                    {/* Gradient Overlay from photo to text */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

                    {/* Featured Badge for Center card */}
                    {isCenter && (
                      <div className="absolute top-4 right-4 z-10">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#B8865B]/90 px-3 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-md">
                          ★ ĐƯỢC YÊU THÍCH
                        </span>
                      </div>
                    )}

                    {/* Icon Badge & Title Inside Photo Bottom */}
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white z-10">
                      {/* Icon Circle */}
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white mb-2.5 shadow-sm">
                        {item.iconType === 'lotus' ? (
                          <Flower2 className="h-5 w-5" />
                        ) : (
                          <Leaf className="h-4 w-4" />
                        )}
                      </div>

                      <h3
                        className={cn(
                          'font-serif font-bold leading-tight text-white drop-shadow-sm',
                          isCenter ? 'text-2xl sm:text-[26px]' : 'text-lg sm:text-xl'
                        )}
                      >
                        {item.name}
                      </h3>

                      <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-white/85 line-clamp-2">
                        {item.description}
                      </p>

                      {/* Meta Tags */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-white/90">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-[#E58F6F]" />
                          <span>{item.duration}</span>
                        </span>
                        {item.feature && isCenter && (
                          <>
                            <span className="text-white/40">•</span>
                            <span className="inline-flex items-center gap-1 text-[#F0D5C3]">
                              <Leaf className="h-3.5 w-3.5 text-[#E58F6F]" />
                              <span>{item.feature}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom / Footer Button */}
                  <div className="mt-auto p-4 sm:p-5 bg-white flex flex-col justify-end">
                    {isCenter ? (
                      <Link
                        href={item.bookingUrl}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8D381B] py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#762E15] hover:shadow-lg active:scale-95"
                      >
                        <span>Đặt lịch ngay</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveIdx(itemIndex);
                        }}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#D9CDC0] bg-[#FAF7F2] py-2.5 text-xs sm:text-sm font-medium text-[#782E15] transition-all hover:bg-white hover:border-[#8D381B] active:scale-95 cursor-pointer"
                      >
                        <span>Xem chi tiết</span>
                        <span className="text-xs">&gt;</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5-Dash Progress Indicators matching mockup */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {SERVICES.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              aria-label={`Đi tới ${s.name}`}
              className="group py-1 cursor-pointer"
            >
              <div
                className={cn(
                  'h-[3px] rounded-full transition-all duration-500',
                  idx === activeIdx
                    ? 'w-10 bg-[#8D381B]'
                    : 'w-6 bg-[#D8CCC0] group-hover:bg-[#8D381B]/50'
                )}
              />
            </button>
          ))}
        </div>

        {/* View All Services Link */}
        <div className="mt-10 text-center">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-full border border-[#D8C7B8] bg-white/80 px-6 py-3 text-xs sm:text-sm font-semibold text-[#8D381B] shadow-xs transition-all hover:bg-white hover:border-[#8D381B] hover:shadow-sm"
          >
            <span>Xem đầy đủ bảng giá và chi tiết liệu trình</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
