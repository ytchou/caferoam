import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SWRConfig } from 'swr';
import React from 'react';
import { makeStamp } from '@/lib/test-utils/factories';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import ProfilePage from './page';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    SWRConfig,
    { value: { provider: () => new Map() } },
    children
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  function mockAllEndpoints(
    overrides: {
      profile?: Record<string, unknown>;
      stamps?: unknown[];
      checkins?: unknown[];
      listSummaries?: unknown[];
    } = {}
  ) {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            overrides.profile ?? {
              display_name: 'Mei-Ling',
              avatar_url: null,
              stamp_count: 2,
              checkin_count: 1,
            },
        });
      }
      if (url.includes('/api/stamps')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            overrides.stamps ?? [
              { ...makeStamp({ id: 'stamp-1' }), shop_name: 'Fika Coffee' },
            ],
        });
      }
      if (url.includes('/api/checkins')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            overrides.checkins ?? [
              {
                id: 'ci-1',
                user_id: 'user-1',
                shop_id: 'shop-a',
                shop_name: 'Fika Coffee',
                shop_mrt: 'Daan',
                photo_urls: ['https://example.com/p.jpg'],
                stars: 4,
                review_text: null,
                created_at: '2026-03-01T00:00:00Z',
              },
            ],
        });
      }
      if (url.includes('/api/lists/summaries')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            overrides.listSummaries ?? [
              {
                id: 'list-1',
                name: 'Favourites',
                shop_count: 3,
                preview_photos: [],
              },
            ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  }

  it('renders profile header with display name and stats', async () => {
    mockAllEndpoints();
    render(<ProfilePage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Mei-Ling')).toBeInTheDocument();
    });
    expect(screen.getByText(/2 stamps/)).toBeInTheDocument();
    expect(screen.getByText(/1 check-in/)).toBeInTheDocument();
  });

  it('renders the stamp passport section', async () => {
    mockAllEndpoints();
    render(<ProfilePage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/my passport/i)).toBeInTheDocument();
    });
  });

  it('shows check-ins tab content', async () => {
    mockAllEndpoints();
    const user = userEvent.setup();
    render(<ProfilePage />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByRole('tab', { name: /check-ins/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: /check-ins/i }));

    await waitFor(() => {
      expect(screen.getByText('Fika Coffee')).toBeInTheDocument();
    });
  });

  it('shows lists tab content', async () => {
    mockAllEndpoints();
    const user = userEvent.setup();
    render(<ProfilePage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /lists/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: /lists/i }));

    await waitFor(() => {
      expect(screen.getByText('Favourites')).toBeInTheDocument();
    });
  });
});
