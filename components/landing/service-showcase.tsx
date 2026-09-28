'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Flower2, Leaf, Sparkles, Star } from 'lucide-react';
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
  const [activeIdx, setActiveIdx] = useState(2); // Gội đầu dưỡng sinh active by default (center)

  const handlePrev = () => {
    setActiveIdx((prev) => (prev - 1 + SERVICES.length) % SERVICES.length);
  };

  const handleNext = () => {
    setActiveIdx((prev) => (prev + 1) % SERVICES.length);
  };

  return (
    <section id="dich-vu" className="relative scroll-mt-20 overflow-hidden bg-[#FAF6F0] py-20 lg:py-28">
      {/* Background Ambience & Dappled Light */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-[#EFE3D5]/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#EBDDCF]/50 blur-3xl" />

      {/* Decorative floral watermark corner */}
      <div className="pointer-events-none absolute top-4 right-8 h-40 w-40 opacity-10 text-[#8D381B] hidden lg:block">
        <Flower2 className="h-full w-full rotate-12" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 justify-center">
            <span className="h-[1px] w-8 sm:w-12 bg-[#8D381B]/40" />
            <Flower2 className="h-4 w-4 text-[#8D381B]" />
            <span className="text-xs sm:text-[13px] font-bold tracking-[0.25em] text-[#8D381B] uppercase">
              LUMIÈRE SPA
            </span>
            <span className="h-[1px] w-8 sm:w-12 bg-[#8D381B]/40" />
          </div>

          {/* Heading */}
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-[46px] font-medium leading-[1.15] tracking-[-0.02em] text-[#1F1A17]">
            Chọn dịch vụ phù hợp cho bạn
          </h2>

          {/* Subtitle */}
          <p className="mt-3.5 text-[15px] sm:text-[16px] leading-[1.75] text-[#6B5F54]">
            Mỗi liệu trình tại Lumière Spa được thiết kế để nuôi dưỡng vẻ đẹp tự nhiên, giúp bạn cân bằng thân – tâm – trí.
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative mt-12 sm:mt-16">
          {/* Navigation Button: Prev (<) */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Dịch vụ trước"
            className="absolute left-1 sm:left-2 lg:-left-4 top-1/2 -translate-y-1/2 z-30 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/95 text-[#1F1A17] shadow-[0_8px_25px_rgba(0,0,0,0.15)] ring-1 ring-black/5 transition-all hover:bg-white hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.2]" />
          </button>

          {/* Navigation Button: Next (>) */}
          <button
            type="button"
            onClick={handleNext}
            aria-label="Dịch vụ tiếp theo"
            className="absolute right-1 sm:right-2 lg:-right-4 top-1/2 -translate-y-1/2 z-30 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/95 text-[#1F1A17] shadow-[0_8px_25px_rgba(0,0,0,0.15)] ring-1 ring-black/5 transition-all hover:bg-white hover:scale-105 active:scale-95"
          >
            <ChevronRight className="h-6 w-6 stroke-[2.2]" />
          </button>

          {/* 5 Cards Row */}
          <div className="flex items-center justify-center gap-4 sm:gap-5 overflow-x-auto pb-4 pt-6 px-4 no-scrollbar snap-x snap-mandatory">
            {SERVICES.map((item, idx) => {
              const isActive = idx === activeIdx;

              return (
                <div
                  key={item.id}
                  onClick={() => setActiveIdx(idx)}
                  className={cn(
                    'relative shrink-0 rounded-[28px] overflow-hidden transition-all duration-500 cursor-pointer snap-center select-none flex flex-col',
                    'w-[280px] sm:w-[290px] xl:w-[305px]',
                    isActive
                      ? 'scale-100 lg:scale-[1.04] z-20 shadow-[0_25px_60px_rgba(40,25,15,0.18)] ring-2 ring-[#8D381B]/20 bg-white min-h-[530px] sm:min-h-[560px]'
                      : 'scale-95 opacity-85 hover:opacity-100 hover:scale-[0.98] z-10 shadow-[0_12px_35px_rgba(40,25,15,0.08)] bg-[#FFFDF9] min-h-[500px] sm:min-h-[520px]'
                  )}
                >
                  {/* Photo with Overlay */}
                  <div className="relative h-[290px] sm:h-[310px] w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    />

                    {/* Gradient Overlay from photo to text */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

                    {/* Featured Badge if present */}
                    {item.badge && (
                      <div className="absolute top-4 right-4 z-10">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#8D381B]/85 px-3 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-md">
                          {item.badge}
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

                      <h3 className="font-serif text-xl sm:text-2xl font-bold leading-tight text-white drop-shadow-sm">
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
                        {item.feature && (
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
                    {isActive ? (
                      <Link
                        href={item.bookingUrl}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8D381B] py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#762E15] hover:shadow-lg active:scale-95"
                      >
                        <span>Đặt lịch ngay</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <Link
                        href={item.detailUrl}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#D9CDC0] bg-[#FAF7F2] py-2.5 text-xs sm:text-sm font-medium text-[#782E15] transition-all hover:bg-white hover:border-[#8D381B] active:scale-95"
                      >
                        <span>Xem chi tiết</span>
                        <span className="text-xs">&gt;</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Indicators */}
          <div className="mt-8 flex items-center justify-center gap-2">
            {SERVICES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                aria-label={`Đi tới dịch vụ ${s.name}`}
                className="group py-1 cursor-pointer"
              >
                <div
                  className={cn(
                    'h-[3px] rounded-full transition-all duration-500',
                    idx === activeIdx
                      ? 'w-10 bg-[#8D381B]'
                      : 'w-5 bg-[#D8CCC0] group-hover:bg-[#8D381B]/50'
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
      </div>
    </section>
  );
}
