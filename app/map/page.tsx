'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { List, Map as MapIcon } from 'lucide-react';
import { SearchBar } from '@/components/discovery/search-bar';
import { FilterPills } from '@/components/discovery/filter-pills';
import { MapMiniCard } from '@/components/map/map-mini-card';
import { MapDesktopCard } from '@/components/map/map-desktop-card';
import { MapListView } from '@/components/map/map-list-view';
import { useIsDesktop } from '@/lib/hooks/use-media-query';
import { useShops } from '@/lib/hooks/use-shops';
import { useGeolocation } from '@/lib/hooks/use-geolocation';

const MapView = dynamic(
  () =>
    import('@/components/map/map-view').then((m) => ({ default: m.MapView })),
  { ssr: false }
);

export default function MapPage() {
  const router = useRouter();
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const { shops } = useShops({ featured: true, limit: 200 });
  const isDesktop = useIsDesktop();
  const { latitude, longitude } = useGeolocation();

  const shopById = useMemo(() => new Map(shops.map((s) => [s.id, s])), [shops]);
  const selectedShop = selectedShopId
    ? (shopById.get(selectedShopId) ?? null)
    : null;

  function handleSearch(query: string) {
    router.push(`/map?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {viewMode === 'map' ? (
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
      ) : (
        <div className="h-full pt-20">
          <MapListView shops={shops} userLat={latitude} userLng={longitude} />
        </div>
      )}

      <div className="absolute top-4 right-4 left-4 z-20">
        <div className="space-y-2 rounded-2xl bg-white/90 p-3 shadow backdrop-blur-md supports-[not(backdrop-filter)]:bg-white">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchBar onSubmit={handleSearch} />
            </div>
            <button
              onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white"
              aria-label={viewMode === 'map' ? 'Switch to list view' : 'Switch to map view'}
            >
              {viewMode === 'map' ? (
                <List className="h-5 w-5 text-gray-600" />
              ) : (
                <MapIcon className="h-5 w-5 text-gray-600" />
              )}
            </button>
          </div>
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

      {viewMode === 'map' && selectedShop && !isDesktop && (
        <MapMiniCard
          shop={selectedShop}
          onDismiss={() => setSelectedShopId(null)}
        />
      )}
      {viewMode === 'map' && selectedShop && isDesktop && (
        <MapDesktopCard shop={selectedShop} />
      )}
    </div>
  );
}
