"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/discovery/search-bar";
import { SuggestionChips } from "@/components/discovery/suggestion-chips";
import { ModeChips } from "@/components/discovery/mode-chips";
import { FilterPills } from "@/components/discovery/filter-pills";
import { FilterSheet } from "@/components/discovery/filter-sheet";
import { ShopCard } from "@/components/shops/shop-card";
import type { Shop } from "@/lib/types";

type Mode = "work" | "rest" | "social" | "specialty" | null;

type ShopCardData = Pick<Shop, "id" | "name" | "rating"> & {
  slug?: string;
  mrt?: string;
  photoUrls?: string[];
  photo_urls?: string[];
};

interface HomePageProps {
  shops?: ShopCardData[];
}

export default function HomePage({ shops = [] }: HomePageProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const handleSearch = (query: string) => {
    const params = new URLSearchParams({ q: query });
    if (mode) params.set("mode", mode);
    if (activeFilters.length) params.set("filters", activeFilters.join(","));
    router.push(`/map?${params.toString()}`);
  };

  const handleToggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((x) => x !== filter) : [...prev, filter]
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F4]">
      {/* Hero section */}
      <section className="px-4 pt-8 pb-4 bg-[#E06B3F]">
        <h1 className="text-2xl font-bold text-white mb-4">啡遊</h1>
        <SearchBar onSubmit={handleSearch} autoFocus={false} />
        <div className="mt-3">
          <SuggestionChips onSelect={handleSearch} />
        </div>
      </section>

      {/* Filters */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <ModeChips activeMode={mode} onModeChange={setMode} />
        <div className="mt-2">
          <FilterPills
            activeFilters={activeFilters}
            onToggle={handleToggleFilter}
            onOpenSheet={() => setFilterSheetOpen(true)}
          />
        </div>
      </div>

      {/* Featured shops */}
      <section className="px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">精選咖啡廳</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      </section>

      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        onApply={(ids) => {
          setActiveFilters(ids);
          setFilterSheetOpen(false);
        }}
        initialFilters={activeFilters}
      />
    </div>
  );
}
