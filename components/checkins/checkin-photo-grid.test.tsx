import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SWRConfig } from 'swr';
import React from 'react';

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

import { CheckInPhotoGrid } from './checkin-photo-grid';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    SWRConfig,
    { value: { provider: () => new Map() } },
    children
  );
}

const CHECKINS = [
  {
    id: 'ci-1',
    user_id: 'user-1',
    display_name: '小明',
    photo_url: 'https://example.com/p1.jpg',
    note: 'Great latte',
    created_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'ci-2',
    user_id: 'user-2',
    display_name: '小華',
    photo_url: 'https://example.com/p2.jpg',
    note: null,
    created_at: '2026-03-02T10:00:00Z',
  },
];

describe('CheckInPhotoGrid', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('shows photo grid and count badge for authenticated view', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => CHECKINS,
    });

    render(<CheckInPhotoGrid shopId="shop-1" isAuthenticated={true} />, {
      wrapper,
    });

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(2);
    });
  });

  it('shows count and login CTA for unauthenticated view', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 47,
        preview_photo_url: 'https://example.com/p1.jpg',
      }),
    });

    render(<CheckInPhotoGrid shopId="shop-1" isAuthenticated={false} />, {
      wrapper,
    });

    await waitFor(() => {
      expect(screen.getByText(/47 visits/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/log in/i)).toBeInTheDocument();
  });

  it('shows nothing when shop has zero check-ins', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0, preview_photo_url: null }),
    });

    render(<CheckInPhotoGrid shopId="shop-1" isAuthenticated={false} />, {
      wrapper,
    });

    await waitFor(() => {
      expect(screen.queryByText(/visits/i)).not.toBeInTheDocument();
    });
  });
});
