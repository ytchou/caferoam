'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { SearchBar } from '@/components/discovery/search-bar';
import { FilterPills } from '@/components/discovery/filter-pills';
import { MapMiniCard } from '@/components/map/map-mini-card';
import { MapDesktopCard } from '@/components/map/map-desktop-card';
import { useIsDesktop } from '@/lib/hooks/use-media-query';
import { useShops } from '@/lib/hooks/use-shops';

const MapView = dynamic(
  () =>
    import('@/components/map/map-view').then((m) => ({ default: m.MapView })),
  { ssr: false }
);

export default function MapPage() {
  const router = useRouter();
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const { shops } = useShops({ featured: true, limit: 200 });
  const isDesktop = useIsDesktop();

  const shopById = useMemo(
    () => new Map(shops.map((s) => [s.id, s])),
    [shops]
  );
  const selectedShop = selectedShopId
    ? (shopById.get(selectedShopId) ?? null)
    : null;

  const handleSearch = (query: string) => {
    router.push(`/map?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
              地圖載入中…
            </div>
          }
        >
          <MapView shops={shops} onPinClick={setSelectedShopId} />
        </Suspense>
      </div>

      <div className="absolute top-4 right-4 left-4 z-20">
        <div className="space-y-2 rounded-2xl bg-white/90 p-3 shadow backdrop-blur-md supports-[not(backdrop-filter)]:bg-white">
          <SearchBar onSubmit={handleSearch} />
          <FilterPills
            activeFilters={activeFilters}
            onToggle={(f) =>
              setActiveFilters((prev) =>
                prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
              )
            }
            onOpenSheet={() => {}}
          />
        </div>
      </div>

      {selectedShop && !isDesktop && (
        <MapMiniCard shop={selectedShop} onDismiss={() => setSelectedShopId(null)} />
      )}
      {selectedShop && isDesktop && (
        <MapDesktopCard shop={selectedShop} />
      )}
    </div>
  );
}
