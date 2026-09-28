'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Clock,
  Filter,
  RotateCcw,
  Search,
  Sparkles,
  SlidersHorizontal,
  X,
  UserCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SITE } from '@/lib/site-config';
import {
  formatDuration,
  formatPrice,
  categoryLabel,
  normalizeCategory,
  SERVICE_CATEGORIES,
  type Service,
} from '@/lib/types';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Logo } from '@/components/logo';
import { LeadDialog } from '@/components/landing/lead-form';
import { MobileActionBar } from '@/components/landing/contact-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DURATION_FILTERS = [
  { label: 'Tất cả thời lượng', value: 'all' },
  { label: '< 60 phút', value: 'under_60' },
  { label: '60 – 90 phút', value: '60_90' },
  { label: '> 90 phút', value: 'over_90' },
];

const SORT_OPTIONS = [
  { label: 'Thứ tự mặc định', value: 'default' },
  { label: 'Giá: Thấp đến cao', value: 'price_asc' },
  { label: 'Giá: Cao đến thấp', value: 'price_desc' },
  { label: 'Thời lượng ngắn nhất', value: 'duration_asc' },
  { label: 'Thời lượng dài nhất', value: 'duration_desc' },
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDuration, setSelectedDuration] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<string>('default');
  const [onlyCombo, setOnlyCombo] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('price');
      setServices(data || []);
      setLoading(false);
    })();
  }, []);

  // Filter & Sort Logic
  const filteredServices = useMemo(() => {
    return services
      .filter((svc) => {
        // Search
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchName = svc.name.toLowerCase().includes(q);
          const matchDesc = (svc.description || '').toLowerCase().includes(q);
          const matchCat = categoryLabel(svc.category).toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchCat) return false;
        }

        // Category filter
        if (selectedCategory !== 'all') {
          if (selectedCategory === 'combo') {
            if (!svc.includes || svc.includes.length === 0) return false;
          } else {
            if (normalizeCategory(svc.category) !== selectedCategory) return false;
          }
        }

        // Only combo switch
        if (onlyCombo && (!svc.includes || svc.includes.length === 0)) {
          return false;
        }

        // Duration filter
        if (selectedDuration === 'under_60' && svc.duration_min >= 60) return false;
        if (selectedDuration === '60_90' && (svc.duration_min < 60 || svc.duration_min > 90)) return false;
        if (selectedDuration === 'over_90' && svc.duration_min <= 90) return false;

        return true;
      })
      .sort((a, b) => {
        if (selectedSort === 'price_asc') return a.price - b.price;
        if (selectedSort === 'price_desc') return b.price - a.price;
        if (selectedSort === 'duration_asc') return a.duration_min - b.duration_min;
        if (selectedSort === 'duration_desc') return b.duration_min - a.duration_min;
        return 0; // default order
      });
  }, [services, search, selectedCategory, onlyCombo, selectedDuration, selectedSort]);

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedDuration !== 'all' ||
    selectedSort !== 'default' ||
    onlyCombo;

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedDuration('all');
    setSelectedSort('default');
    setOnlyCombo(false);
  };

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      <SiteHeader />

      {/* Hero Header */}
      <section className="border-b border-border bg-[hsl(var(--cream-soft))] py-12 lg:py-16">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="max-w-2xl">
            <span className="eyebrow">Dịch vụ &amp; Liệu trình · {SITE.name}</span>
            <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Chọn liệu trình <em className="font-normal text-primary">thích hợp cho bạn.</em>
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Toàn bộ danh mục chăm sóc cơ thể, massage trị liệu và gội đầu dưỡng sinh. Giá niêm yết rõ ràng, không phát sinh chi phí ẩn.
            </p>
          </div>

          {/* Search bar */}
          <div className="mt-8 flex max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên dịch vụ hoặc liệu trình..."
                className="h-12 pl-10 pr-10 text-sm bg-card shadow-sm rounded-xl"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="h-12 gap-1.5 rounded-xl border-border px-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Đặt lại
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content & Filters */}
      <section className="mx-auto max-w-[1200px] px-6 py-10 lg:py-12">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pb-6 border-b border-border">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Tất cả ({services.length})
          </button>
          {SERVICE_CATEGORIES.map((cat) => {
            const count = services.filter((s) => normalizeCategory(s.category) === cat.value).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  selectedCategory === cat.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === 'combo' ? 'all' : 'combo')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              selectedCategory === 'combo'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            ✨ Combo ưu đãi ({services.filter((s) => (s.includes?.length ?? 0) > 0).length})
          </button>
        </div>

        {/* Sub-Filters: Duration & Sorting */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5 text-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Thời lượng:
            </span>
            {DURATION_FILTERS.map((df) => (
              <button
                key={df.value}
                type="button"
                onClick={() => setSelectedDuration(df.value)}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  selectedDuration === df.value
                    ? 'bg-foreground text-background font-bold'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Sắp xếp:</span>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="input-base h-9 text-xs rounded-lg py-1 px-2.5 max-w-[180px]"
            >
              {SORT_OPTIONS.map((so) => (
                <option key={so.value} value={so.value}>
                  {so.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Hiển thị <strong>{filteredServices.length}</strong> / {services.length} dịch vụ
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-primary hover:underline font-semibold"
            >
              Xóa các bộ lọc đang chọn
            </button>
          )}
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="grid gap-6 pt-8 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card-base h-80 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="my-16 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Filter className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-serif text-2xl font-medium text-foreground">Không tìm thấy dịch vụ phù hợp</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Không có dịch vụ nào khớp với bộ lọc hoặc từ khóa bạn vừa nhập. Vui lòng thử lại với tiêu chí khác.
            </p>
            <Button onClick={resetFilters} variant="outline" className="mt-6">
              <RotateCcw className="mr-2 h-4 w-4" /> Đặt lại bộ lọc
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service, i) => {
              const isCombo = (service.includes?.length ?? 0) > 0;
              const save =
                service.compare_at_price && service.compare_at_price > service.price
                  ? service.compare_at_price - service.price
                  : 0;

              return (
                <div
                  key={service.id}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  {/* Service Image Banner */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                    {service.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={service.image_url}
                        alt={service.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-secondary to-accent/10">
                        <span className="font-serif text-3xl text-primary/30">Lumière</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80" />
                    <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-0.5 text-xs font-semibold text-white">
                      {categoryLabel(service.category)}
                    </span>
                    {isCombo && (
                      <span className="absolute top-3 right-3 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
                        Combo{save ? ` · tiết kiệm ${formatPrice(save)}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Service Info */}
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="font-serif text-2xl font-medium text-foreground group-hover:text-primary transition-colors">
                      {service.name}
                    </h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground line-clamp-3">
                      {service.description}
                    </p>

                    {isCombo && (
                      <div className="mt-4 rounded-xl bg-muted/40 p-3 border border-border/50">
                        <p className="text-xs font-semibold text-foreground mb-1.5">Bao gồm các bước:</p>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {service.includes!.map((it) => (
                            <li key={it} className="flex items-center gap-2">
                              <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> {it}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-auto pt-6 border-t border-border flex items-end justify-between gap-3">
                      <div>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {formatDuration(service.duration_min)}
                        </span>
                        <div className="mt-1">
                          {save > 0 && <s className="mr-2 text-xs text-muted-foreground">{formatPrice(service.compare_at_price!)}</s>}
                          <strong className="text-xl font-bold text-primary font-sans">{formatPrice(service.price)}</strong>
                        </div>
                      </div>

                      <Link
                        href={`/booking?service=${service.id}`}
                        className="btn-primary h-10 px-4 text-xs font-bold gap-1 rounded-xl shadow-sm group-hover:shadow"
                      >
                        Đặt lịch <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Consultation Callout */}
        <div className="mt-16 rounded-2xl bg-[hsl(var(--cream-soft))] p-8 sm:p-10 border border-border text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary mb-3" />
          <h3 className="font-serif text-3xl font-medium text-foreground">Bạn chưa biết liệu trình nào phù hợp?</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
            Hãy để lại thông tin, chuyên viên tư vấn của Lumière Spa sẽ liên hệ giải đáp tình trạng da và cơ thể để gợi ý liệu trình tối ưu nhất.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LeadDialog source="services_catalog" interest="Tư vấn chọn liệu trình">
              <Button size="lg" className="rounded-xl px-6 font-semibold">
                Yêu cầu gọi lại tư vấn
              </Button>
            </LeadDialog>
            <Link href="/booking" className="btn-outline h-11 px-6 rounded-xl font-semibold">
              Đặt lịch online ngay
            </Link>
          </div>
        </div>
      </section>

      {/* Synchronized Site Footer */}
      <SiteFooter />

      <MobileActionBar />
    </div>
  );
}
