import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Check,
  Flower2,
  Gift,
  Heart,
  Layers,
  Leaf,
  MapPin,
  Play,
  PlayCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SITE } from '@/lib/site-config';
import {
  formatDuration,
  formatPrice,
  categoryLabel,
  type AppSettings,
  type PublicReview,
  type Service,
  type ServicePackage,
  type Staff,
} from '@/lib/types';
import { SiteHeader } from '@/components/site-header';
import { Logo } from '@/components/logo';
import { PromoBar } from '@/components/landing/promo-bar';
import { HeroCarousel } from '@/components/landing/hero-carousel';
import { LeadDialog, LeadForm } from '@/components/landing/lead-form';
import { ContactButtons, MobileActionBar, OpenStatus } from '@/components/landing/contact-actions';

// Server-rendered (SEO + no loading flash); refreshed every 5 minutes.
export const revalidate = 300;

type PublicStaff = Pick<Staff, 'id' | 'name' | 'avatar_url' | 'role' | 'bio' | 'specialties' | 'years_experience'>;

async function getData() {
  const [svc, settings, staff, packages, reviews, summary] = await Promise.all([
    supabase.from('services').select('*').eq('is_active', true).order('category').order('price').then((r) => r.data || [], () => []),
    supabase.from('app_settings').select('first_visit_enabled, first_visit_discount_pct').eq('id', 1).maybeSingle().then((r) => r.data, () => null),
    // Only public profile fields — never phone / email
    supabase
      .from('staff')
      .select('id, name, avatar_url, role, bio, specialties, years_experience')
      .eq('is_active', true)
      .order('years_experience', { ascending: false, nullsFirst: false })
      .then((r) => r.data || [], () => []),
    supabase.from('service_packages').select('*, services!inner (name, price, duration_min, is_active)').eq('is_active', true).eq('services.is_active', true).order('price').then((r) => r.data || [], () => []),
    supabase.rpc('get_public_reviews', { p_limit: 6 }).then((r) => r.data || [], () => []),
    supabase.rpc('get_review_summary').then((r) => r.data || [], () => []),
  ]);
  const s = (settings as AppSettings | null) ?? { first_visit_enabled: true, first_visit_discount_pct: 10 };
  const sum = (summary as { average: number | null; total: number }[] | null)?.[0];
  return {
    services: (svc || []) as Service[],
    offerPct: s.first_visit_enabled ? s.first_visit_discount_pct : 0,
    staff: (staff || []) as PublicStaff[],
    packages: (packages || []) as ServicePackage[],
    reviews: (reviews || []) as PublicReview[],
    rating: sum && sum.total > 0 ? { average: Number(sum.average), total: sum.total } : null,
  };
}

const givenName = (name: string) => name.trim().split(/\s+/).pop() || name;

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex ${className ?? ''}`} aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= Math.round(value) ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'text-border'}`} />
      ))}
    </span>
  );
}

export default async function HomePage() {
  const { services, offerPct, staff, packages, reviews, rating } = await getData();

  // Local SEO: schema.org DaySpa with address, hours, price list and (real) rating
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DaySpa',
    name: SITE.name,
    url: SITE.url,
    image: `${SITE.url}/spa-hero-new.jpg`,
    telephone: SITE.phone,
    priceRange: services.length
      ? `${formatPrice(Math.min(...services.map((s) => s.price)))} – ${formatPrice(Math.max(...services.map((s) => s.price)))}`
      : undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.addressParts.street,
      addressLocality: SITE.addressParts.district,
      addressRegion: SITE.addressParts.city,
      addressCountry: SITE.addressParts.country,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: SITE.open,
        closes: SITE.close,
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Dịch vụ spa',
      itemListElement: services.map((s) => ({
        '@type': 'Offer',
        price: s.price,
        priceCurrency: 'VND',
        itemOffered: { '@type': 'Service', name: s.name, description: s.description ?? undefined },
      })),
    },
    ...(rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.average, reviewCount: rating.total } } : {}),
  };

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {offerPct > 0 && <PromoBar pct={offerPct} />}
      <SiteHeader />

      {/* Interactive Hero Carousel (4 slides, auto-advance, thumbnails & navigation) */}
      <HeroCarousel offerPct={offerPct} />

      {/* Floating Value Bar matching mockup */}
      <section className="relative -mt-8 sm:-mt-12 z-20 mx-auto max-w-[1360px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-[#EDE5DA] bg-[#FAF7F2] p-6 shadow-[0_15px_45px_rgba(40,25,15,0.06)] sm:p-7">
          {/* Subtle floral watermark corner accents */}
          <div className="pointer-events-none absolute -left-6 -bottom-6 h-28 w-28 opacity-10 text-[#8D381B]">
            <Flower2 className="h-full w-full" />
          </div>
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 opacity-10 text-[#8D381B]">
            <Flower2 className="h-full w-full" />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#EDE5DA]">
            {/* Feature 1: 100% Thảo Mộc Sạch */}
            <div className="flex items-center gap-4 sm:px-4 first:pl-0">
              <span className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#923D20] ring-1 ring-[#E8DC CE]/60">
                <Leaf className="h-6 w-6 stroke-[1.75]" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17] sm:text-[15px]">100% Thảo Mộc Sạch</strong>
                <span className="text-xs text-[#7A6E65]">Được lựa chọn từ thiên nhiên</span>
              </div>
            </div>

            {/* Feature 2: Bảng Giá Minh Bạch */}
            <div className="flex items-center gap-4 sm:px-4 pt-4 sm:pt-0">
              <span className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#923D20] ring-1 ring-[#E8DCCE]/60">
                <ShieldCheck className="h-6 w-6 stroke-[1.75]" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17] sm:text-[15px]">Bảng Giá Minh Bạch</strong>
                <span className="text-xs text-[#7A6E65]">Không Tip - Không chèo kéo</span>
              </div>
            </div>

            {/* Feature 3: Đặt Lịch Nhanh Chóng */}
            <div className="flex items-center gap-4 sm:px-4 pt-4 sm:pt-0">
              <span className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#923D20] ring-1 ring-[#E8DCCE]/60">
                <Calendar className="h-6 w-6 stroke-[1.75]" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17] sm:text-[15px]">Đặt Lịch Nhanh Chóng</strong>
                <span className="text-xs text-[#7A6E65]">Chỉ vài phút, dễ dàng online</span>
              </div>
            </div>

            {/* Feature 4: Đội Ngũ Kỹ Thuật Viên */}
            <div className="flex items-center gap-4 sm:px-4 pt-4 sm:pt-0">
              <span className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#923D20] ring-1 ring-[#E8DCCE]/60">
                <Heart className="h-6 w-6 stroke-[1.75]" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17] sm:text-[15px]">Đội Ngũ Kỹ Thuật Viên</strong>
                <span className="text-xs text-[#7A6E65]">Tận tâm &amp; giàu kinh nghiệm</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intro / Welcome Teaser matching mockup */}
      <section id="ve-chung-toi" className="relative scroll-mt-14 overflow-hidden bg-[#FAF6F0] py-20 lg:py-28">
        {/* Soft sun-dappled foliage shadow effect in top-left corner */}
        <div className="pointer-events-none absolute -left-16 -top-16 h-80 w-80 rounded-full bg-[#EBDDCF]/60 blur-3xl" />
        
        {/* Subtle decorative branch shadow */}
        <div className="pointer-events-none absolute left-0 top-0 h-64 w-64 opacity-[0.04] text-[#1F1A17]">
          <Flower2 className="h-full w-full rotate-45" />
        </div>

        <div className="relative mx-auto max-w-[1360px] px-6 sm:px-10 lg:px-12">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Left Column: Typography, Story & Metrics */}
            <div className="lg:col-span-6 xl:col-span-7">
              {/* Eyebrow with Lotus */}
              <div className="flex items-center gap-2.5">
                <Flower2 className="h-4 w-4 text-[#8D381B]" />
                <span className="text-xs sm:text-[13px] font-bold tracking-[0.25em] text-[#8D381B] uppercase">
                  CHÀO MỪNG ĐẾN LUMIÈRE SPA
                </span>
                <span className="hidden sm:inline-block h-[1px] w-12 bg-[#8D381B]/40" />
              </div>

              {/* Main Headline */}
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[52px] font-medium leading-[1.12] tracking-[-0.02em] text-[#1F1A17]">
                Một nhịp nghỉ vừa vặn
                <br />
                <span className="font-semibold text-[#8D381B]">giữa phố thị.</span>
              </h2>

              {/* Paragraphs */}
              <div className="mt-6 space-y-4 text-[15px] sm:text-[16px] leading-[1.8] text-[#5C5248]">
                <p>
                  Lumière Spa được tạo dựng như một trạm dừng chân an yên, nơi bạn tạm gác lại những vội vã và đời thường để lắng nghe cơ thể, chăm sóc từng thớ cơ và làm mới nguồn năng lượng tươi trẻ bên trong mình.
                </p>
                <p>
                  Mỗi liệu trình là sự hòa quyện giữa tinh hoa thảo mộc, tinh dầu thiên nhiên và bàn tay trị liệu giàu kinh nghiệm, đưa bạn về trạng thái thư thái, cân bằng và trọn vẹn nhất.
                </p>
              </div>

              {/* Stats / Metric Badges */}
              <div className="mt-8 flex flex-wrap items-center gap-4 sm:gap-6 py-2">
                {/* Metric 1 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFE6DC] text-[#8D381B]">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <strong className="block text-xl sm:text-2xl font-bold text-[#1F1A17] leading-none">5.000+</strong>
                    <span className="mt-1 block text-xs text-[#7A6E65]">Lượt khách tin yêu</span>
                  </div>
                </div>

                <div className="hidden sm:block h-10 w-[1px] bg-[#E3D7CB]" />

                {/* Metric 2 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFE6DC] text-[#8D381B]">
                    <Star className="h-5 w-5 fill-[#8D381B]" />
                  </span>
                  <div>
                    <strong className="block text-xl sm:text-2xl font-bold text-[#1F1A17] leading-none">4.9 ★</strong>
                    <span className="mt-1 block text-xs text-[#7A6E65]">1.200+ đánh giá</span>
                  </div>
                </div>

                <div className="hidden sm:block h-10 w-[1px] bg-[#E3D7CB]" />

                {/* Metric 3 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFE6DC] text-[#8D381B]">
                    <Leaf className="h-5 w-5" />
                  </span>
                  <div>
                    <strong className="block text-xl sm:text-2xl font-bold text-[#1F1A17] leading-none">100%</strong>
                    <span className="mt-1 block text-xs text-[#7A6E65]">Tinh dầu ép lạnh</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-9 flex flex-wrap items-center gap-3.5 sm:gap-4">
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 rounded-full bg-[#8D381B] px-7 py-3.5 text-sm sm:text-base font-semibold text-white shadow-md transition-all hover:bg-[#762E15] hover:shadow-lg active:scale-95"
                >
                  <span>Khám phá câu chuyện Lumière Spa</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 rounded-full border border-[#D8C7B8] bg-white/70 px-6 py-3.5 text-sm sm:text-base font-semibold text-[#8D381B] transition-all hover:bg-white active:scale-95"
                >
                  <span>Xem toàn bộ bảng dịch vụ</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Right Column: Rounded Photo & Floating Glass Card */}
            <div className="relative lg:col-span-6 xl:col-span-5">
              {/* Main Rounded Photo */}
              <div className="relative overflow-hidden rounded-[32px] border border-[#EBE3D8] shadow-[0_20px_50px_rgba(40,25,15,0.09)] aspect-[4/3] sm:aspect-[16/12]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/spa-welcome-oil.jpg"
                  alt="Trải nghiệm trị liệu tinh dầu thảo mộc tại Lumière Spa"
                  className="h-full w-full object-cover object-center"
                />
              </div>

              {/* Floating Lotus Circle Badge at top-right corner of image */}
              <div className="absolute -top-3.5 -right-3.5 z-10 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-[#8D381B] text-white shadow-lg ring-4 ring-[#FAF6F0]">
                <Flower2 className="h-6 w-6 stroke-[1.75]" />
              </div>

              {/* Floating Card Overlapping image */}
              <div className="relative mt-4 sm:absolute sm:right-6 sm:bottom-8 sm:mt-0 z-20 w-full sm:max-w-[340px] rounded-2xl border border-[#EDE5DA] bg-white/95 backdrop-blur-md p-5 shadow-[0_16px_40px_rgba(40,25,15,0.12)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9E724E] text-white shadow-sm">
                    <Leaf className="h-5 w-5" />
                  </span>
                  <div>
                    <h4 className="text-sm sm:text-[15px] font-bold text-[#1F1A17]">Hương thảo mộc dịu nhẹ</h4>
                    <p className="font-serif italic text-xs text-[#8D381B]">Âm nhạc thiền an yên</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#F0EAE1] pt-3 text-xs text-[#7A6E65]">
                  <div>
                    <span className="block font-medium">Phục vụ từ {SITE.open} – {SITE.close}</span>
                    <span>hằng ngày tại {SITE.addressParts.district}</span>
                  </div>
                  <Link
                    href="/services"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D9CDC0] text-[#8D381B] transition-colors hover:bg-[#8D381B] hover:text-white"
                    title="Xem dịch vụ"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Script slogan watermark at bottom right */}
          <div className="mt-10 sm:mt-14 text-right hidden sm:block">
            <span className="font-serif italic text-2xl sm:text-3xl text-[#923D20]/50 tracking-wider font-light select-none">
              More than a spa, A kinder you
            </span>
          </div>
        </div>
      </section>

      {/* Services & combos */}
      <section id="dich-vu" className="scroll-mt-20 bg-[hsl(var(--secondary))] py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="eyebrow">Bảng giá liệu trình</span>
              <h2 className="section-heading mt-3">Chọn điều cơ thể bạn cần.</h2>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-2">
              <p className="max-w-[390px] text-[15px] leading-[1.75] text-muted-foreground">
                Giá niêm yết, không phát sinh chi phí ẩn. Bấm vào dịch vụ để xem giờ trống và đặt lịch.
              </p>
              <Link
                href="/services"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Xem tất cả dịch vụ có bộ lọc →
              </Link>
            </div>
          </div>

          {services.length === 0 ? (
            <p className="card-base p-8 text-center text-muted-foreground">Danh sách dịch vụ đang được cập nhật.</p>
          ) : (
            <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-[18px] sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
              {services.map((service, i) => {
                const isCombo = (service.includes?.length ?? 0) > 0;
                const save =
                  service.compare_at_price && service.compare_at_price > service.price ? service.compare_at_price - service.price : 0;
                return (
                  <Link
                    key={service.id}
                    href={`/booking?service=${service.id}`}
                    className="group relative flex min-h-[250px] w-[82%] shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-[hsl(var(--brand-light))] hover:shadow-[0_14px_30px_hsl(var(--brand))/_8%] sm:min-h-[290px] sm:w-auto sm:p-8"
                  >
                    {service.image_url && (
                      <div className="relative -mx-6 -mt-6 mb-5 h-44 overflow-hidden rounded-t-2xl sm:-mx-8 sm:-mt-8">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={service.image_url}
                          alt={service.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80" />
                        <span className="absolute bottom-2.5 left-4 text-xs font-semibold text-white/90 drop-shadow">
                          {categoryLabel(service.category)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-serif text-3xl text-accent">{String(i + 1).padStart(2, '0')}</span>
                      {isCombo && (
                        <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                          Combo{save ? ` · tiết kiệm ${formatPrice(save)}` : ''}
                        </span>
                      )}
                    </div>
                    <h3 className="mb-2 mt-5 font-serif text-2xl font-medium text-foreground">{service.name}</h3>
                    <p className="text-[15px] leading-[1.75] text-muted-foreground">{service.description}</p>
                    {isCombo && (
                      <ul className="mt-3 space-y-1 text-sm text-foreground">
                        {service.includes!.map((it) => (
                          <li key={it} className="flex items-center gap-2">
                            <Check className="h-4 w-4 shrink-0 text-primary" /> {it}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
                      <span>{formatDuration(service.duration_min)}</span>
                      <span className="text-right">
                        {save > 0 && <s className="mr-2 text-xs">{formatPrice(service.compare_at_price!)}</s>}
                        <strong className="text-lg text-primary">{formatPrice(service.price)}</strong>
                      </span>
                    </div>
                  </Link>
                );
              })}
              <div className="flex min-h-[250px] w-[82%] shrink-0 snap-start flex-col rounded-2xl border border-dashed border-primary/30 bg-card/60 p-6 sm:min-h-[290px] sm:w-auto sm:p-8">
                <span className="font-serif text-3xl text-accent">✳</span>
                <h3 className="mb-2 mt-5 font-serif text-2xl font-medium text-foreground">Chưa biết chọn gì?</h3>
                <p className="text-[15px] leading-[1.75] text-muted-foreground">
                  Để lại số điện thoại, chuyên viên sẽ gọi lại tư vấn liệu trình hợp với cơ thể và thời gian của bạn.
                </p>
                <div className="mt-auto border-t border-border pt-6">
                  <LeadDialog source="services_card" interest="Chưa biết chọn dịch vụ nào">
                    <button className="inline-flex items-center gap-1 font-bold text-primary">
                      Nhận tư vấn miễn phí <ArrowRight className="h-4 w-4" />
                    </button>
                  </LeadDialog>
                </div>
              </div>
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground sm:hidden">Vuốt ngang để xem thêm dịch vụ →</p>
        </div>
      </section>

      {/* Offers: first visit · packages · gift cards */}
      <section id="uu-dai" className="mx-auto max-w-[1200px] scroll-mt-20 px-6 py-20 lg:py-24">
        <span className="eyebrow">Ưu đãi &amp; quà tặng</span>
        <h2 className="section-heading mt-3">Tiết kiệm hơn khi đến thường xuyên.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {offerPct > 0 && (
            <article className="flex flex-col rounded-2xl bg-[hsl(var(--deep))] p-7 text-[hsl(var(--cream))]">
              <Sparkles className="h-6 w-6 text-[hsl(var(--gold-light))]" />
              <h3 className="mt-4 font-serif text-2xl">Lần đầu đặt online</h3>
              <p className="mt-1 font-serif text-5xl text-[hsl(var(--gold-light))]">−{offerPct}%</p>
              <p className="mb-6 mt-3 text-sm text-[hsl(var(--cream))]/75">Tự động trừ vào giá khi bạn đặt lịch online lần đầu. Không cần nhập mã.</p>
              <Link href="/booking" className="btn-cream mt-auto w-full">
                Đặt lịch nhận ưu đãi <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          )}

          {packages.map((p) => {
            const single = p.services?.price ?? 0;
            const pct = single ? Math.round((1 - p.price / (single * p.sessions)) * 100) : 0;
            return (
              <article key={p.id} className="card-base flex flex-col p-7">
                <Layers className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-serif text-2xl text-foreground">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.sessions} buổi {p.services?.name}
                  {p.services?.duration_min ? ` · ${formatDuration(p.services.duration_min)}/buổi` : ''}
                </p>
                <p className="mt-4">
                  <strong className="font-serif text-3xl text-primary">{formatPrice(p.price)}</strong>
                  {pct > 0 && <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">Tiết kiệm {pct}%</span>}
                </p>
                {single > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ≈ {formatPrice(Math.round(p.price / p.sessions / 1000) * 1000)}/buổi thay vì {formatPrice(single)}
                  </p>
                )}
                <LeadDialog source="package" interest="Gói liệu trình nhiều buổi">
                  <button className="btn-outline mt-auto w-full">Đăng ký tư vấn gói</button>
                </LeadDialog>
              </article>
            );
          })}

          <article className="card-base flex flex-col p-7">
            <Gift className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-serif text-2xl text-foreground">Thẻ quà tặng</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Tặng người thân một buổi thư giãn dịp sinh nhật, 8/3, 20/10. Người nhận tự đặt lịch online bằng mã trên thẻ.
            </p>
            <ul className="mb-6 mt-4 space-y-1.5 text-sm text-foreground">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Chọn theo mệnh giá hoặc số buổi</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Nhận thiệp in hoặc mã qua Zalo</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Hoàn lại vào thẻ nếu hủy lịch</li>
            </ul>
            <LeadDialog source="gift_card" interest="Thẻ quà tặng">
              <button className="btn-primary mt-auto w-full">Mua thẻ quà tặng</button>
            </LeadDialog>
          </article>
        </div>
      </section>

      {/* Team */}
      {staff.length > 0 && (
        <section id="doi-ngu" className="scroll-mt-20 bg-card py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="eyebrow">Đội ngũ kỹ thuật viên</span>
                <h2 className="section-heading mt-3">Đôi tay bạn có thể tin tưởng.</h2>
              </div>
              <p className="max-w-[390px] text-[15px] leading-[1.75] text-muted-foreground">
                Bạn có thể chọn đúng kỹ thuật viên mình thích khi đặt lịch.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((m) => (
                <article key={m.id} className="flex flex-col rounded-2xl border border-border bg-background p-6">
                  <div className="flex items-center gap-4">
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatar_url} alt={m.name} width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-2xl text-primary">
                        {givenName(m.name).charAt(0)}
                      </span>
                    )}
                    <div>
                      <h3 className="font-serif text-xl text-foreground">{m.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {m.role === 'therapist' ? 'Kỹ thuật viên' : m.role}
                        {m.years_experience ? ` · ${m.years_experience} năm kinh nghiệm` : ''}
                      </p>
                    </div>
                  </div>
                  {(m.specialties?.length ?? 0) > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {m.specialties!.map((sp) => (
                        <span key={sp} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                          {sp}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.bio && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{m.bio}</p>}
                  <Link href={`/booking?staff=${m.id}`} className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-bold text-primary">
                    Đặt lịch với {givenName(m.name)} <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Feature */}
      <section className="bg-[hsl(var(--deep))] py-20 text-white lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div>
              <span className="eyebrow text-[hsl(var(--gold-light))]">Tận hưởng theo cách của bạn</span>
              <h2 className="section-heading mt-3 max-w-[520px] text-white">Thời gian nghỉ ngơi cũng xứng đáng được chăm chút.</h2>
              <p className="mt-5 max-w-[520px] text-[15px] leading-[1.75] text-white/70">
                Dành cho những buổi nghỉ ngắn giữa tuần hay một khoảng thư giãn cuối tuần. Chỉ cần chọn dịch vụ, chọn thời gian và để chúng tôi chuẩn bị phần còn lại.
              </p>
              <Link href="/booking" className="btn-cream mt-7">
                Giữ chỗ cho tôi <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="border-t border-white/30">
              {[
                { num: '01', title: 'Lựa chọn linh hoạt', desc: 'Liệu trình từ 30 đến 90 phút, dễ sắp xếp trong lịch trình của bạn.' },
                { num: '02', title: 'Giá rõ ràng', desc: 'Giá niêm yết trên web, không phát sinh chi phí ẩn.' },
                { num: '03', title: 'Đặt lịch thuận tiện', desc: 'Chọn giờ trống và nhận mã đặt lịch ngay, không cần chờ gọi lại.' },
              ].map((item) => (
                <div key={item.num} className="flex gap-6 border-b border-white/30 py-7">
                  <b className="font-serif text-2xl text-[hsl(var(--gold-light))]">{item.num}</b>
                  <div>
                    <h3 className="mb-1 text-base font-bold">{item.title}</h3>
                    <p className="text-sm text-white/70">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reviews — only real, published reviews from completed appointments */}
      {rating && reviews.length > 0 && (
        <section id="danh-gia" className="scroll-mt-20 py-20 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="eyebrow">Khách hàng nói gì</span>
                <h2 className="section-heading mt-3">
                  {rating.average.toLocaleString('vi-VN')}/5 từ {rating.total} lượt đánh giá.
                </h2>
              </div>
              <p className="max-w-[390px] text-sm leading-relaxed text-muted-foreground">
                Chỉ khách đã hoàn thành buổi hẹn mới đánh giá được, từ trang Tài khoản của mình.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <figure key={r.id} className="card-base flex flex-col p-6">
                  <Quote className="h-6 w-6 text-accent" />
                  <Stars value={r.rating} className="mt-3" />
                  <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-foreground">“{r.comment}”</blockquote>
                  <figcaption className="mt-5 text-sm text-muted-foreground">
                    <b className="text-foreground">{r.author}</b>
                    {r.service_name ? ` · ${r.service_name}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Journey */}
      <section id="trai-nghiem" className="scroll-mt-20 bg-card py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <span className="eyebrow">Một buổi hẹn thật nhẹ nhàng</span>
          <h2 className="section-heading mt-3">Ba bước để bắt đầu.</h2>
          <div className="mt-12 grid grid-cols-1 gap-11 sm:grid-cols-3">
            {[
              { n: '01 / Chọn', title: 'Tìm liệu trình', desc: 'Xem dịch vụ, thời lượng và mức giá phù hợp với bạn.' },
              { n: '02 / Hẹn', title: 'Chọn giờ còn trống', desc: 'Xem khung giờ trống theo thời gian thực, lịch được xác nhận ngay.' },
              { n: '03 / Thư giãn', title: 'Đến Lumière Spa', desc: 'Đến trước giờ hẹn 10 phút và dành thời gian cho chính mình.' },
            ].map((step) => (
              <div key={step.n} className="border-t border-border pt-6">
                <span className="text-base font-bold text-accent">{step.n}</span>
                <h3 className="mb-2 mt-6 font-serif text-2xl font-medium text-foreground">{step.title}</h3>
                <p className="text-[15px] leading-[1.75] text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact + callback form */}
      <section id="lien-he" className="scroll-mt-20 bg-[hsl(30_42%_90%)] py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <span className="eyebrow">Hẹn một khoảng nghỉ</span>
              <h2 className="section-heading mt-3">Hôm nay, bạn muốn dành thời gian cho mình chứ?</h2>
              <OpenStatus className="mt-5" />
              <dl className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <dt className="mb-2 text-sm text-muted-foreground">Địa chỉ</dt>
                  <dd className="font-semibold text-foreground">{SITE.address}</dd>
                </div>
                <div>
                  <dt className="mb-2 text-sm text-muted-foreground">Điện thoại</dt>
                  <dd className="font-semibold text-foreground">{SITE.phone}</dd>
                </div>
                <div>
                  <dt className="mb-2 text-sm text-muted-foreground">Giờ mở cửa</dt>
                  <dd className="font-semibold text-foreground">{SITE.hours}</dd>
                </div>
              </dl>
              <ContactButtons className="mt-7" />
              <a
                href={SITE.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted-foreground hover:border-primary/40"
              >
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
                Mở Google Maps để xem đường đi và chỗ gửi xe
                <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
              </a>
            </div>
            <div className="rounded-2xl bg-card p-7 shadow-[0_18px_50px_hsl(var(--brand))_8%] sm:p-9">
              <h3 className="font-serif text-3xl font-medium text-foreground">Để lại SĐT, spa gọi tư vấn</h3>
              <p className="mb-6 mt-2 text-sm text-muted-foreground">
                Chưa chắc chọn liệu trình nào, muốn mua gói hoặc thẻ quà tặng? Chuyên viên sẽ gọi lại trong giờ mở cửa.
              </p>
              <LeadForm source="contact" idPrefix="contact-lead" />
              <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
                Đã biết mình muốn gì?{' '}
                <Link href="/booking" className="font-semibold text-primary hover:underline">
                  Đặt lịch online ngay →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[hsl(var(--deep-footer))] py-14 text-white">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Logo inverted />
              <p className="mt-4 max-w-[310px] text-sm text-white/70">Một khoảng lặng để chăm sóc cơ thể và làm mới tinh thần.</p>
              <p className="mt-4 text-sm text-white/70">
                {SITE.address} · {SITE.phone}
              </p>
            </div>
            <div className="flex flex-wrap gap-12 text-sm">
              <div className="flex flex-col gap-3">
                <strong className="mb-2">Khám phá</strong>
                <Link href="/" className="text-white font-semibold transition-colors hover:text-[hsl(var(--gold-light))]">Trang chủ</Link>
                <Link href="/about" className="text-white/70 transition-colors hover:text-[hsl(var(--gold-light))]">Giới thiệu</Link>
                <Link href="/services" className="text-white/70 transition-colors hover:text-[hsl(var(--gold-light))]">Tất cả dịch vụ</Link>
                <a href="#uu-dai" className="text-white/70 transition-colors hover:text-[hsl(var(--gold-light))]">Ưu đãi &amp; quà tặng</a>
              </div>
              <div className="flex flex-col gap-3">
                <strong className="mb-2">Liên hệ</strong>
                <a href="#lien-he" className="text-white/70 transition-colors hover:text-[hsl(var(--gold-light))]">Địa chỉ &amp; tư vấn</a>
                <a href={SITE.zalo} target="_blank" rel="noopener noreferrer" className="text-white/70 transition-colors hover:text-[hsl(var(--gold-light))]">Zalo</a>
                <Link href="/booking" className="text-white/70 transition-colors hover:text-[hsl(var(--gold-light))]">Đặt lịch online</Link>
              </div>
            </div>
          </div>
          <div className="mt-14 border-t border-white/20 pt-6 text-xs text-white/50">© 2026 Lumière Spa. Dành một chút thời gian cho chính bạn.</div>
        </div>
      </footer>

      <MobileActionBar />
    </div>
  );
}
