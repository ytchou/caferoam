import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

vi.mock('@/lib/hooks/use-shops', () => ({
  useShops: () => ({
    shops: [
      {
        id: '1',
        name: '山小孩咖啡',
        slug: 'shan-xiao-hai-ka-fei',
        rating: 4.6,
      },
      { id: '2', name: '好咖啡', slug: 'hao-ka-fei', rating: 4.2 },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/components/discovery/search-bar', () => ({
  SearchBar: ({ onSubmit }: { onSubmit: (q: string) => void }) => (
    <div>
      <input placeholder="search" onChange={() => {}} />
      <button onClick={() => onSubmit('espresso')}>Search</button>
    </div>
  ),
}));
vi.mock('@/components/discovery/suggestion-chips', () => ({
  SuggestionChips: ({ onSelect }: { onSelect: (s: string) => void }) => (
    <button onClick={() => onSelect('適合工作')}>suggestion</button>
  ),
}));
vi.mock('@/components/discovery/mode-chips', () => ({
  ModeChips: () => <div data-testid="mode-chips" />,
}));
vi.mock('@/components/discovery/filter-pills', () => ({
  FilterPills: () => <div data-testid="filter-pills" />,
}));
vi.mock('@/components/shops/shop-card', () => ({
  ShopCard: ({ shop }: { shop: { name: string } }) => <div>{shop.name}</div>,
}));
vi.mock('@/components/discovery/filter-sheet', () => ({
  FilterSheet: () => <div data-testid="filter-sheet" />,
}));

import HomePage from './page';

describe('Home page', () => {
  it('a visitor sees the search bar on load', () => {
    render(<HomePage />);
    expect(screen.getByPlaceholderText('search')).toBeInTheDocument();
  });

  it('a visitor sees featured shop cards on load', () => {
    render(<HomePage />);
    expect(screen.getByText('山小孩咖啡')).toBeInTheDocument();
    expect(screen.getByText('好咖啡')).toBeInTheDocument();
  });

  it('search submission navigates to /map with query param', () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Search'));
    expect(mockPush).toHaveBeenCalledWith('/map?q=espresso');
  });

  it('suggestion chip selection navigates to /map with query param', () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('suggestion'));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/map?'));
  });

  it('a visitor sees the featured section heading', () => {
    render(<HomePage />);
    expect(screen.getByText('精選咖啡廳')).toBeInTheDocument();
  });
});
