import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('react-map-gl/mapbox', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="interactive-map" {...props} />
  ),
  Marker: () => <div data-testid="marker" />,
}));

import { ShopMapThumbnail } from './shop-map-thumbnail';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
    media: query,
  }));
}

describe('ShopMapThumbnail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('on mobile, a visitor sees a static map image', () => {
    stubMatchMedia(false);
    render(
      <ShopMapThumbnail
        latitude={25.033}
        longitude={121.543}
        shopName="山小孩咖啡"
      />
    );
    const img = screen.getByRole('img', { name: /map/i });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain('api.mapbox.com/styles/v1');
  });

  it('on desktop, a visitor sees an interactive map embed', async () => {
    stubMatchMedia(true);
    render(
      <ShopMapThumbnail
        latitude={25.033}
        longitude={121.543}
        shopName="山小孩咖啡"
      />
    );
    expect(await screen.findByTestId('interactive-map')).toBeInTheDocument();
  });
});
