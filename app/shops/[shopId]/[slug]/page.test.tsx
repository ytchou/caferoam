import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/posthog/use-analytics', () => ({
  useAnalytics: () => ({ capture: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: vi.fn(),
}));
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock('@/components/shops/share-button', () => ({
  ShareButton: () => <button>Share</button>,
}));
vi.mock('@/components/shops/shop-map-thumbnail', () => ({
  ShopMapThumbnail: () => <div data-testid="shop-map-thumbnail" />,
}));

import { ShopDetailClient } from './shop-detail-client';

const MOCK_SHOP = {
  id: 'shop-001',
  name: '山小孩咖啡',
  slug: 'shan-xiao-hai-ka-fei',
  address: '台北市大安區',
  latitude: 25.033,
  longitude: 121.543,
  rating: 4.6,
  reviewCount: 287,
  description: 'A cozy coffee shop',
  photoUrls: ['https://example.com/photo.jpg'],
  taxonomyTags: [{ id: 'quiet', dimension: 'ambience', label: 'Quiet', labelZh: '安靜' }],
  modeScores: { work: 0.8, rest: 0.6, social: 0.3 },
};

describe('ShopDetailClient', () => {
  it('a visitor can see the shop name and rating', () => {
    render(<ShopDetailClient shop={MOCK_SHOP} />);
    expect(screen.getByText('山小孩咖啡')).toBeInTheDocument();
    expect(screen.getByText(/4\.6/)).toBeInTheDocument();
  });

  it("a visitor sees the shop's attribute tags at a glance", () => {
    render(<ShopDetailClient shop={MOCK_SHOP} />);
    expect(screen.getByText('安靜')).toBeInTheDocument();
  });

  it('a visitor can read the shop description', () => {
    render(<ShopDetailClient shop={MOCK_SHOP} />);
    expect(screen.getByText('A cozy coffee shop')).toBeInTheDocument();
  });
});
