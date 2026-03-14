import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

// Mock heavy dependencies at the boundary
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-shops', () => ({
  useShops: () => ({
    shops: [
      {
        id: '1',
        name: 'Test Cafe',
        latitude: 25.03,
        longitude: 121.56,
        rating: 4.5,
        slug: 'test-cafe',
        photoUrls: [],
        mrt: null,
        address: '',
        phone: null,
        website: null,
        openingHours: null,
        reviewCount: 0,
        priceRange: null,
        description: null,
        menuUrl: null,
        taxonomyTags: [],
        cafenomadId: null,
        googlePlaceId: null,
        createdAt: '',
        updatedAt: '',
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/lib/hooks/use-media-query', () => ({
  useIsDesktop: () => false,
}));

vi.mock('@/lib/hooks/use-geolocation', () => ({
  useGeolocation: () => ({
    latitude: null,
    longitude: null,
    error: null,
    loading: false,
    requestLocation: vi.fn(),
  }),
}));

// Mock MapView since it requires Mapbox GL (browser-only)
vi.mock('@/components/map/map-view', () => ({
  MapView: ({ shops }: { shops: unknown[] }) => (
    <div data-testid="map-view">Map with {shops.length} pins</div>
  ),
}));

// Mock next/dynamic to return a simple passthrough component
// that renders the already-mocked MapView stub inline
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const StubMapView = (props: Record<string, unknown>) => (
      <div data-testid="map-view">
        Map with {(props.shops as unknown[])?.length ?? 0} pins
      </div>
    );
    return StubMapView;
  },
}));

import MapPage from './page';

describe('Map page', () => {
  it('shows map view by default', () => {
    render(<MapPage />);
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
  });

  it('toggles to list view when user clicks the list toggle', async () => {
    const user = userEvent.setup();
    render(<MapPage />);

    const toggle = screen.getByRole('button', { name: /list/i });
    await user.click(toggle);

    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument(); // ShopCard renders <article>
  });

  it('toggles back to map view', async () => {
    const user = userEvent.setup();
    render(<MapPage />);

    const listToggle = screen.getByRole('button', { name: /list/i });
    await user.click(listToggle);

    const mapToggle = screen.getByRole('button', { name: /map/i });
    await user.click(mapToggle);

    expect(screen.getByTestId('map-view')).toBeInTheDocument();
  });
});
