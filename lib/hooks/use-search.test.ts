import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Declare mock with vi.hoisted to avoid hoisting ReferenceError
const mockFetchWithAuth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/fetch', () => ({
  fetchWithAuth: mockFetchWithAuth,
}));

// SWR wrapper
import { SWRConfig } from 'swr';
import React from 'react';
const createWrapper = () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      SWRConfig,
      { value: { provider: () => new Map() } },
      children
    );
  Wrapper.displayName = 'SWRTestWrapper';
  return Wrapper;
};

import { useSearch } from './use-search';

const MOCK_RESULTS = [
  {
    id: 'shop-001',
    name: '山小孩咖啡',
    slug: 'shan-xiao-hai-ka-fei',
    rating: 4.6,
  },
];

describe('useSearch', () => {
  beforeEach(() => {
    mockFetchWithAuth.mockClear();
  });

  it('does not fetch when query is null', () => {
    renderHook(() => useSearch(null, null), { wrapper: createWrapper() });
    expect(mockFetchWithAuth).not.toHaveBeenCalled();
  });

  it('fetches search results when query is provided', async () => {
    mockFetchWithAuth.mockResolvedValue({ results: MOCK_RESULTS });
    const { result } = renderHook(() => useSearch('espresso bar', null), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('search')
    );
  });

  it('passes mode parameter when set', async () => {
    mockFetchWithAuth.mockResolvedValue({ results: [] });
    renderHook(() => useSearch('coffee', 'work'), { wrapper: createWrapper() });
    await waitFor(() => expect(mockFetchWithAuth).toHaveBeenCalled());
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('mode=work')
    );
  });

  it('returns isLoading=true while fetching', () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSearch('latte', null), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });
});
