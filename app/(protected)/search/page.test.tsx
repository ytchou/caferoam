import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const { mockUseSearchState, mockUseSearch } = vi.hoisted(() => ({
  mockUseSearchState: vi.fn(),
  mockUseSearch: vi.fn(),
}));

vi.mock('@/lib/hooks/use-search-state', () => ({
  useSearchState: mockUseSearchState,
}));

vi.mock('@/lib/hooks/use-search', () => ({
  useSearch: mockUseSearch,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/search',
}));

vi.mock('@/components/shops/shop-card', () => ({
  ShopCard: ({ shop }: { shop: { name: string } }) => (
    <div data-testid="shop-card">{shop.name}</div>
  ),
}));
vi.mock('@/components/discovery/suggestion-chips', () => ({
  SuggestionChips: () => <div data-testid="suggestion-chips" />,
}));
vi.mock('@/components/discovery/search-bar', () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));

import SearchPage from './page';

describe('Search results page', () => {
  const defaultSearchState = {
    query: 'espresso',
    mode: null,
    filters: [],
    setQuery: vi.fn(),
    setMode: vi.fn(),
    toggleFilter: vi.fn(),
    clearAll: vi.fn(),
  };

  it('renders search results as shop cards when query present', () => {
    mockUseSearchState.mockReturnValue(defaultSearchState);
    mockUseSearch.mockReturnValue({
      results: [
        { id: '1', name: '山小孩咖啡', slug: 'shan', rating: 4.6 },
        { id: '2', name: '好咖啡', slug: 'hao', rating: 4.2 },
      ],
      isLoading: false,
      error: null,
    });
    render(<SearchPage />);
    expect(screen.getAllByTestId('shop-card')).toHaveLength(2);
    expect(screen.getByText('山小孩咖啡')).toBeInTheDocument();
  });

  it('shows empty state with suggestions when no results', () => {
    mockUseSearchState.mockReturnValue(defaultSearchState);
    mockUseSearch.mockReturnValue({
      results: [],
      isLoading: false,
      error: null,
    });
    render(<SearchPage />);
    expect(screen.getByTestId('suggestion-chips')).toBeInTheDocument();
    expect(screen.getByText(/沒有找到結果|No results/i)).toBeInTheDocument();
  });

  it('shows loading state while searching', () => {
    mockUseSearchState.mockReturnValue(defaultSearchState);
    mockUseSearch.mockReturnValue({
      results: [],
      isLoading: true,
      error: null,
    });
    render(<SearchPage />);
    expect(screen.getByText(/搜尋中|Loading/i)).toBeInTheDocument();
  });
});
