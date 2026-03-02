import { render, screen, waitFor } from '@testing-library/react';
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
  usePathname: () => '/admin/taxonomy',
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const testSession = makeSession();

import TaxonomyPage from './page';

function makeTaxonomyStats(overrides: Record<string, unknown> = {}) {
  return {
    total_shops: 52,
    shops_with_tags: 40,
    shops_with_embeddings: 38,
    shops_missing_tags: 12,
    shops_missing_embeddings: 14,
    tag_frequency: [
      { tag_id: 'wifi', shop_count: 35 },
      { tag_id: 'power_outlets', shop_count: 28 },
      { tag_id: 'quiet', shop_count: 22 },
    ],
    low_confidence_shops: [
      {
        id: 'shop-lc1',
        name: '小破爛咖啡',
        max_confidence: 0.32,
      },
      {
        id: 'shop-lc2',
        name: '路易莎民生店',
        max_confidence: 0.45,
      },
    ],
    missing_embeddings: [
      {
        id: 'shop-me1',
        name: '好丘信義店',
        processing_status: 'enriched',
      },
      {
        id: 'shop-me2',
        name: '咖啡黑潮',
        processing_status: 'scraped',
      },
    ],
    ...overrides,
  };
}

describe('TaxonomyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getSession.mockResolvedValue({
      data: { session: testSession },
      error: null,
    });
  });

  it('renders coverage stat cards with correct numbers and percentages', async () => {
    const stats = makeTaxonomyStats();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(stats),
    });

    render(<TaxonomyPage />);

    await waitFor(() => {
      expect(screen.getByText('52')).toBeInTheDocument();
    });

    // Total Shops
    expect(screen.getByText('Total Shops')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();

    // With Tags: 40 (76.9%)
    expect(screen.getByText('With Tags')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('76.9%')).toBeInTheDocument();

    // With Embeddings: 38 (73.1%)
    expect(screen.getByText('With Embeddings')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getByText('73.1%')).toBeInTheDocument();

    // Missing Coverage: 12 + 14 = 26
    expect(screen.getByText('Missing Coverage')).toBeInTheDocument();
    expect(screen.getByText('26')).toBeInTheDocument();

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/taxonomy/stats', {
      headers: {
        Authorization: `Bearer ${testSession.access_token}`,
      },
    });
  });

  it('renders tag frequency table sorted by shop count descending', async () => {
    const stats = makeTaxonomyStats();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(stats),
    });

    render(<TaxonomyPage />);

    await waitFor(() => {
      expect(screen.getByText('wifi')).toBeInTheDocument();
    });

    expect(screen.getByText('power_outlets')).toBeInTheDocument();
    expect(screen.getByText('quiet')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();

    // Verify table headers
    expect(screen.getByText('Tag ID')).toBeInTheDocument();
    expect(screen.getByText('Shop Count')).toBeInTheDocument();
  });

  it('shows error state when the taxonomy stats API returns an error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({ detail: 'Forbidden: admin role required' }),
    });

    render(<TaxonomyPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Forbidden: admin role required')
    ).toBeInTheDocument();
  });
});
