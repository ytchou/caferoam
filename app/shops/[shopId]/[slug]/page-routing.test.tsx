import { vi, describe, it, expect, beforeEach } from 'vitest';
import { notFound, redirect } from 'next/navigation';
import ShopDetailPage from './page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  redirect: vi.fn(),
}));

vi.mock('./shop-detail-client', () => ({
  ShopDetailClient: () => null,
}));

const mockShop = {
  id: 'a1b2c3d4',
  name: 'Fika Fika Cafe',
  slug: 'fika-fika-cafe',
  description: 'Award-winning specialty coffee in Taipei',
  photo_urls: ['https://example.com/photo.jpg'],
};

describe('ShopDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('calls notFound when the shop does not exist', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      status: 404,
      ok: false,
    } as Response);

    await expect(
      ShopDetailPage({ params: { shopId: 'a1b2c3d4', slug: 'fika-fika-cafe' } })
    ).rejects.toThrow('NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
  });

  it('redirects to the canonical slug when the URL slug does not match', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue(mockShop),
    } as unknown as Response);

    await ShopDetailPage({ params: { shopId: 'a1b2c3d4', slug: 'old-slug' } });

    expect(redirect).toHaveBeenCalledWith('/shops/a1b2c3d4/fika-fika-cafe');
  });

  it('renders ShopDetailClient when the shop exists with the correct slug', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue(mockShop),
    } as unknown as Response);

    const element = await ShopDetailPage({
      params: { shopId: 'a1b2c3d4', slug: 'fika-fika-cafe' },
    });

    expect(notFound).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(element).toBeDefined();
  });
});
