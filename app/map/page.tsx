"use client";
import dynamic from "next/dynamic";
import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/discovery/search-bar";
import { FilterPills } from "@/components/discovery/filter-pills";
import { MapMiniCard } from "@/components/map/map-mini-card";

const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => ({ default: m.MapView })),
  { ssr: false },
);

// Placeholder shop data — will be replaced by useShops hook post-data-gate
const PLACEHOLDER_SHOPS: Array<{
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  rating: number;
}> = [];

export default function MapPage() {
  const router = useRouter();
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const selectedShop = PLACEHOLDER_SHOPS.find((s) => s.id === selectedShopId) ?? null;

  const handleSearch = (query: string) => {
    router.push(`/map?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Map (full bleed) */}
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
              地圖載入中…
            </div>
          }
        >
          <MapView shops={PLACEHOLDER_SHOPS} onPinClick={setSelectedShopId} />
        </Suspense>
      </div>

      {/* Search overlay */}
      <div className="absolute left-4 right-4 top-4 z-20">
        <div className="space-y-2 rounded-2xl bg-white/90 p-3 shadow backdrop-blur-md supports-[not(backdrop-filter)]:bg-white">
          <SearchBar onSubmit={handleSearch} />
          <FilterPills
            activeFilters={activeFilters}
            onToggle={(f) =>
              setActiveFilters((prev) =>
                prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
              )
            }
            onOpenSheet={() => {}}
          />
        </div>
      </div>

      {/* Selected shop card */}
      {selectedShop && (
        <MapMiniCard shop={selectedShop} onDismiss={() => setSelectedShopId(null)} />
      )}
    </div>
  );
}
