import { renderHook, waitFor } from '@testing-library/react';
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

import { useUserStamps } from './use-user-stamps';

const STAMPS = [
  {
    id: 'stamp-1',
    user_id: 'user-1',
    shop_id: 'shop-a',
    check_in_id: 'ci-1',
    design_url: '/stamps/shop-a.svg',
    earned_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'stamp-2',
    user_id: 'user-1',
    shop_id: 'shop-b',
    check_in_id: 'ci-2',
    design_url: '/stamps/shop-b.svg',
    earned_at: '2026-03-02T10:00:00Z',
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    SWRConfig,
    { value: { provider: () => new Map() } },
    children
  );
}

describe('useUserStamps', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => STAMPS,
    });
  });

  it('fetches stamps from /api/stamps', async () => {
    const { result } = renderHook(() => useUserStamps(), { wrapper });
    await waitFor(() => expect(result.current.stamps).toHaveLength(2));
    expect(result.current.stamps[0].design_url).toBe('/stamps/shop-a.svg');
  });

  it('reports loading state initially', () => {
    const { result } = renderHook(() => useUserStamps(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns empty array when no stamps', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    const { result } = renderHook(() => useUserStamps(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stamps).toEqual([]);
  });
});
