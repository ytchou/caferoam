import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MapListView } from './map-list-view';

// Mock next/navigation (required by ShopCard)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const shops = [
  { id: '1', name: 'Alpha Cafe', latitude: 25.03, longitude: 121.56, rating: 4.5, slug: 'alpha-cafe', photoUrls: [], mrt: 'Zhongxiao', address: '', phone: null, website: null, openingHours: null, reviewCount: 0, priceRange: null, description: null, menuUrl: null, taxonomyTags: [], cafenomadId: null, googlePlaceId: null, createdAt: '', updatedAt: '' },
  { id: '2', name: 'Beta Brew', latitude: 25.04, longitude: 121.57, rating: 4.2, slug: 'beta-brew', photoUrls: [], mrt: 'Daan', address: '', phone: null, website: null, openingHours: null, reviewCount: 0, priceRange: null, description: null, menuUrl: null, taxonomyTags: [], cafenomadId: null, googlePlaceId: null, createdAt: '', updatedAt: '' },
];

describe('MapListView', () => {
  it('renders all shops as cards sorted alphabetically when no location', () => {
    render(<MapListView shops={shops} userLat={null} userLng={null} />);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Alpha Cafe');
    expect(cards[1]).toHaveTextContent('Beta Brew');
  });

  it('sorts shops by distance when user location is provided', () => {
    // User is closer to Beta Brew (25.04, 121.57)
    render(<MapListView shops={shops} userLat={25.041} userLng={121.571} />);
    const cards = screen.getAllByRole('article');
    expect(cards[0]).toHaveTextContent('Beta Brew');
    expect(cards[1]).toHaveTextContent('Alpha Cafe');
  });

  it('shows empty state when no shops', () => {
    render(<MapListView shops={[]} userLat={null} userLng={null} />);
    expect(screen.getByText(/no shops/i)).toBeInTheDocument();
  });
});
