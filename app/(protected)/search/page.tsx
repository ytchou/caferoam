'use client';
import { useSearch } from '@/lib/hooks/use-search';
import { useSearchState } from '@/lib/hooks/use-search-state';
import { ShopCard } from '@/components/shops/shop-card';
import { SuggestionChips } from '@/components/discovery/suggestion-chips';
import { SearchBar } from '@/components/discovery/search-bar';

export default function SearchPage() {
  const { query, mode, setQuery } = useSearchState();
  const { results, isLoading, error } = useSearch(query || null, mode);

  return (
    <div className="min-h-screen bg-[#FAF7F4]">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
        <SearchBar onSubmit={setQuery} defaultQuery={query} />
      </div>

      <div className="px-4 py-4">
        {isLoading && (
          <div className="py-12 text-center text-gray-400">搜尋中…</div>
        )}

        {!isLoading && !error && results.length === 0 && (
          <div className="py-8 text-center">
            <p className="mb-4 text-gray-500">
              {query ? `沒有找到結果「${query}」` : '輸入關鍵字開始搜尋'}
            </p>
            <SuggestionChips onSelect={setQuery} />
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-4">
            {results.map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop as Parameters<typeof ShopCard>[0]['shop']}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
