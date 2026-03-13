import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
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

vi.mock('@/lib/posthog/use-analytics', () => ({
  useAnalytics: () => ({ capture: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-geolocation', () => ({
  useGeolocation: () => ({
    requestLocation: vi.fn(),
    latitude: null,
    longitude: null,
    error: null,
    loading: false,
  }),
}));

import HomePage from './page';

describe('Home page', () => {
  it('When a visitor opens the home page, they see featured coffee shop names', () => {
    render(<HomePage />);
    expect(screen.getByText('山小孩咖啡')).toBeInTheDocument();
    expect(screen.getByText('好咖啡')).toBeInTheDocument();
  });

  it('When a visitor opens the home page, they see the 精選咖啡廳 section heading', () => {
    render(<HomePage />);
    expect(screen.getByText('精選咖啡廳')).toBeInTheDocument();
  });

  it('When a visitor opens the home page, they see the search bar', () => {
    render(<HomePage />);
    expect(screen.getByRole('search')).toBeInTheDocument();
  });
});
