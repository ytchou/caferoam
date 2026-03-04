import { render, screen, waitFor } from '@testing-library/react';
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

  it('shows the stamp passport with earned stamps', async () => {
    const stamps = [
      makeStamp({ id: 'stamp-1' }),
      makeStamp({
        id: 'stamp-2',
        shop_id: 'shop-b',
        design_url: '/stamps/shop-b.svg',
      }),
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => stamps });

    render(<ProfilePage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/my passport/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/2 stamps/i)).toBeInTheDocument();
  });

  it('shows empty passport when user has no stamps', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    render(<ProfilePage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/0 stamps/i)).toBeInTheDocument();
    });
  });
});
