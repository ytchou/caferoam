import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSWRWrapper } from '@/lib/test-utils/wrappers';
import { makeSession } from '@/lib/test-utils/factories';

const testSession = makeSession();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: testSession },
      }),
    },
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { useUserCheckins } from './use-user-checkins';

const CHECKINS = [
  {
    id: 'ci-1',
    user_id: 'user-a1b2c3',
    shop_id: 'shop-d4e5f6',
    shop_name: '山小孩咖啡',
    shop_mrt: '台電大樓',
    photo_urls: ['https://example.com/photo1.jpg'],
    stars: 4,
    review_text: '很棒的工作環境',
    created_at: '2026-03-01T10:00:00Z',
  },
];

const wrapper = createSWRWrapper();

describe('useUserCheckins', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => CHECKINS,
    });
  });

  it('given a user with check-ins, shop names and ratings are available', async () => {
    const { result } = renderHook(() => useUserCheckins(), { wrapper });
    await waitFor(() => expect(result.current.checkins).toHaveLength(1));
    expect(result.current.checkins[0].shop_name).toBe('山小孩咖啡');
  });

  it('shows empty state while data is loading', () => {
    const { result } = renderHook(() => useUserCheckins(), { wrapper });
    expect(result.current.checkins).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('given a new user with no check-ins, shows empty collection', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    const { result } = renderHook(() => useUserCheckins(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.checkins).toEqual([]);
  });

  it('given a server error, surfaces the error to the consumer', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Server error' }),
    });
    const { result } = renderHook(() => useUserCheckins(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeDefined();
  });
});
