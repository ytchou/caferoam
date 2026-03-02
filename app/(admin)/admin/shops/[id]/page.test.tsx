import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseAuth,
  createMockRouter,
} from '@/lib/test-utils/mocks';
import { makeSession } from '@/lib/test-utils/factories';

const mockAuth = createMockSupabaseAuth();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: mockAuth }),
}));

const mockRouter = createMockRouter();
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/admin/shops/shop-1',
  useParams: () => ({ id: 'shop-1' }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const testSession = makeSession();

import AdminShopDetail from './page';

function makeShopDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shop-1',
    name: '山小孩咖啡',
    address: '台北市大安區溫州街74巷5弄2號',
    latitude: 25.0216,
    longitude: 121.5312,
    processing_status: 'live',
    source: 'cafe_nomad',
    description: '安靜適合工作的獨立咖啡店，提供精品手沖咖啡',
    mode_scores: {
      work: 0.85,
      rest: 0.6,
      social: 0.4,
    },
    tags: [
      { tag: 'wifi-stable', confidence: 0.92 },
      { tag: 'quiet', confidence: 0.78 },
      { tag: 'power-outlets', confidence: 0.55 },
      { tag: 'outdoor-seating', confidence: 0.3 },
    ],
    photos: [
      {
        url: 'https://example.supabase.co/storage/v1/object/public/shop-photos/shop-1/exterior.jpg',
        category: 'exterior',
        is_menu: false,
      },
      {
        url: 'https://example.supabase.co/storage/v1/object/public/shop-photos/shop-1/menu.jpg',
        category: 'menu',
        is_menu: true,
      },
    ],
    ...overrides,
  };
}

describe('AdminShopDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getSession.mockResolvedValue({
      data: { session: testSession },
      error: null,
    });
  });

  it('renders shop detail with name and status when the API returns shop data', async () => {
    const shopData = makeShopDetail();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(shopData),
    });

    render(<AdminShopDetail />);

    await waitFor(() => {
      expect(screen.getByText('山小孩咖啡')).toBeInTheDocument();
    });

    expect(screen.getByText('live')).toBeInTheDocument();
    expect(
      screen.getByText('台北市大安區溫州街74巷5弄2號')
    ).toBeInTheDocument();
    expect(screen.getByText('cafe_nomad')).toBeInTheDocument();

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/shops/shop-1', {
      headers: {
        Authorization: `Bearer ${testSession.access_token}`,
      },
    });
  });

  it('shows tags with confidence indicators when shop has taxonomy tags', async () => {
    const shopData = makeShopDetail();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(shopData),
    });

    render(<AdminShopDetail />);

    await waitFor(() => {
      expect(screen.getByText('wifi-stable')).toBeInTheDocument();
    });

    expect(screen.getByText('quiet')).toBeInTheDocument();
    expect(screen.getByText('power-outlets')).toBeInTheDocument();
    expect(screen.getByText('outdoor-seating')).toBeInTheDocument();

    expect(screen.getByText('0.92')).toBeInTheDocument();
    expect(screen.getByText('0.78')).toBeInTheDocument();
    expect(screen.getByText('0.55')).toBeInTheDocument();
    expect(screen.getByText('0.30')).toBeInTheDocument();
  });

  it('shows error state when the shop detail API returns an error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({ detail: 'Shop not found' }),
    });

    render(<AdminShopDetail />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Shop not found')).toBeInTheDocument();
  });
});
