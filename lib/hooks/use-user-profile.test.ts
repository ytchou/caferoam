import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSWRWrapper } from '@/lib/test-utils/wrappers';

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

import { useUserProfile } from './use-user-profile';

const PROFILE = {
  display_name: 'Mei-Ling',
  avatar_url: null,
  stamp_count: 5,
  checkin_count: 12,
};

const wrapper = createSWRWrapper();

describe('useUserProfile', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => PROFILE,
    });
  });

  it('given a logged-in user, display name and stamp count are available', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });
    await waitFor(() =>
      expect(result.current.profile?.display_name).toBe('Mei-Ling')
    );
    expect(result.current.profile?.stamp_count).toBe(5);
    expect(result.current.profile?.checkin_count).toBe(12);
  });

  it('shows null profile while data is loading', () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });
    expect(result.current.profile).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('given a server error, surfaces the error to the consumer', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Server error' }),
    });
    const { result } = renderHook(() => useUserProfile(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeDefined();
  });
});
