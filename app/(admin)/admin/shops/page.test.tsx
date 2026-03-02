import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseAuth,
  createMockRouter,
} from '@/lib/test-utils/mocks';
import { makeSession, makeShop } from '@/lib/test-utils/factories';

const mockAuth = createMockSupabaseAuth();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: mockAuth }),
}));

const mockRouter = createMockRouter();
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/admin/shops',
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const testSession = makeSession();

import AdminShopsList from './page';

describe('AdminShopsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getSession.mockResolvedValue({
      data: { session: testSession },
      error: null,
    });
  });

  it('renders shops table with data when the API returns a list of shops', async () => {
    const shopsResponse = {
      shops: [
        makeShop({
          id: 'shop-001',
          name: '山小孩咖啡',
          address: '台北市大安區溫州街74巷5弄2號',
          processing_status: 'live',
          source: 'cafe_nomad',
          updated_at: '2026-02-28T10:00:00.000Z',
        }),
        makeShop({
          id: 'shop-002',
          name: '森高砂咖啡',
          address: '台北市中正區羅斯福路三段210巷8弄12號',
          processing_status: 'pending',
          source: 'google_maps',
          updated_at: '2026-03-01T14:30:00.000Z',
        }),
      ],
      total: 2,
      offset: 0,
      limit: 20,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(shopsResponse),
    });

    render(<AdminShopsList />);

    await waitFor(() => {
      expect(screen.getByText('山小孩咖啡')).toBeInTheDocument();
    });

    expect(screen.getByText('森高砂咖啡')).toBeInTheDocument();
    expect(
      screen.getByText('台北市大安區溫州街74巷5弄2號')
    ).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('cafe_nomad')).toBeInTheDocument();
    expect(within(table).getByText('google_maps')).toBeInTheDocument();
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/shops'),
      expect.objectContaining({
        headers: {
          Authorization: `Bearer ${testSession.access_token}`,
        },
      })
    );
  });

  it('shows create shop form when the Create Shop button is clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ shops: [], total: 0, offset: 0, limit: 20 }),
    });

    const user = userEvent.setup();
    render(<AdminShopsList />);

    await waitFor(() => {
      expect(screen.getByText('Shops')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', {
      name: /create shop/i,
    });
    await user.click(createButton);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
  });

  it('shows error state when the shops API returns an error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Forbidden: admin role required' }),
    });

    render(<AdminShopsList />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Forbidden: admin role required')
    ).toBeInTheDocument();
  });
});
