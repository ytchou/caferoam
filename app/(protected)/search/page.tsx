"use client";
import { useSearch } from "@/lib/hooks/use-search";
import { useSearchState } from "@/lib/hooks/use-search-state";
import { ShopCard } from "@/components/shops/shop-card";
import { SuggestionChips } from "@/components/discovery/suggestion-chips";
import { SearchBar } from "@/components/discovery/search-bar";

export default function SearchPage() {
  const { query, mode, setQuery } = useSearchState();
  const { results, isLoading, error } = useSearch(query || null, mode);

  const handleSearch = (q: string) => setQuery(q);
  const handleSuggestion = (s: string) => setQuery(s);

  return (
    <div className="min-h-screen bg-[#FAF7F4]">
      {/* Search header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <SearchBar onSubmit={handleSearch} defaultQuery={query} />
      </div>

      <div className="px-4 py-4">
        {isLoading && (
          <div className="text-center py-12 text-gray-400">搜尋中…</div>
        )}

        {!isLoading && !error && results.length === 0 && query && (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">沒有找到結果「{query}」</p>
            <SuggestionChips onSelect={handleSuggestion} />
          </div>
        )}

        {!isLoading && !error && results.length === 0 && !query && (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">輸入關鍵字開始搜尋</p>
            <SuggestionChips onSelect={handleSuggestion} />
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-4">
            {results.map((shop) => (
              <ShopCard key={shop.id} shop={shop as Parameters<typeof ShopCard>[0]["shop"]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
