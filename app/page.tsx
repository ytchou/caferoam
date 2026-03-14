'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SearchBar } from '@/components/discovery/search-bar';
import { SuggestionChips } from '@/components/discovery/suggestion-chips';
import { ModeChips } from '@/components/discovery/mode-chips';
import { FilterPills } from '@/components/discovery/filter-pills';
import { FilterSheet } from '@/components/discovery/filter-sheet';
import { ShopCard } from '@/components/shops/shop-card';
import { useShops } from '@/lib/hooks/use-shops';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import type { SearchMode } from '@/lib/hooks/use-search-state';

export default function HomePage() {
  const router = useRouter();
  const { shops } = useShops({ featured: true, limit: 12 });
  const { requestLocation, latitude, longitude } = useGeolocation();
  const [mode, setMode] = useState<SearchMode>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  function handleSearch(query: string) {
    const params = new URLSearchParams({ q: query });
    if (mode) params.set('mode', mode);
    if (activeFilters.length) params.set('filters', activeFilters.join(','));
    router.push(`/map?${params.toString()}`);
  }

  async function handleNearMe() {
    await requestLocation();
    if (latitude && longitude) {
      const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude), radius: '5' });
      if (mode) params.set('mode', mode);
      router.push(`/map?${params.toString()}`);
    } else {
      toast('無法取得位置，改用文字搜尋');
      handleSearch('我附近');
    }
  }

  function handleToggleFilter(filter: string) {
    setActiveFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((x) => x !== filter)
        : [...prev, filter]
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4]">
      <section className="bg-[#E06B3F] px-4 pt-8 pb-4">
        <h1 className="mb-4 text-2xl font-bold text-white">啡遊</h1>
        <SearchBar onSubmit={handleSearch} autoFocus={false} />
        <div className="mt-3">
          <SuggestionChips onSelect={handleSearch} onNearMe={handleNearMe} />
        </div>
      </section>

      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
        <ModeChips activeMode={mode} onModeChange={setMode} />
        <div className="mt-2">
          <FilterPills
            activeFilters={activeFilters}
            onToggle={handleToggleFilter}
            onOpenSheet={() => setFilterSheetOpen(true)}
          />
        </div>
      </div>

      <section className="px-4 py-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">精選咖啡廳</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      </section>

      <FilterSheet
        key={filterSheetOpen ? 'open' : 'closed'}
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        onApply={setActiveFilters}
        initialFilters={activeFilters}
      />
    </div>
  );
}
