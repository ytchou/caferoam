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

import { useListSummaries } from './use-list-summaries';

const SUMMARIES = [
  {
    id: 'list-1',
    name: '適合工作的咖啡店',
    shop_count: 3,
    preview_photos: ['https://example.com/photo1.jpg'],
  },
  {
    id: 'list-2',
    name: '約會好去處',
    shop_count: 1,
    preview_photos: [],
  },
];

const wrapper = createSWRWrapper();

describe('useListSummaries', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => SUMMARIES,
    });
  });

  it('given a user with saved lists, list names and shop counts are available', async () => {
    const { result } = renderHook(() => useListSummaries(), { wrapper });
    await waitFor(() => expect(result.current.lists).toHaveLength(2));
    expect(result.current.lists[0].name).toBe('適合工作的咖啡店');
    expect(result.current.lists[0].shop_count).toBe(3);
  });

  it('shows empty state while data is loading', () => {
    const { result } = renderHook(() => useListSummaries(), { wrapper });
    expect(result.current.lists).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('given a new user with no lists, shows empty collection', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    const { result } = renderHook(() => useListSummaries(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.lists).toEqual([]);
  });

  it('given a server error, surfaces the error to the consumer', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Server error' }),
    });
    const { result } = renderHook(() => useListSummaries(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeDefined();
  });
});
