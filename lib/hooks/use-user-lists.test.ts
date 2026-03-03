import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock supabase auth
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
          },
        },
      }),
    },
  }),
}));

import { useUserLists } from './use-user-lists';

const LIST_ID_1 = 'e3b0c442-98a1-441d-b22f-5a00bd8c3e1b';
const LIST_ID_2 = 'f4c1d553-a9b2-552e-c330-6b11ce9d4f2c';
const USER_ID = 'c7d2a819-5e3f-4c8b-b6a0-1234567890ab';
const SHOP_ID_1 = 'a1b2c3d4-5678-90ab-cdef-1234567890ab';
const SHOP_ID_2 = 'b2c3d4e5-6789-01bc-def0-2345678901bc';
const SHOP_ID_3 = 'c3d4e5f6-789a-12cd-ef01-3456789012cd';

const LISTS_RESPONSE = [
  {
    id: LIST_ID_1,
    user_id: USER_ID,
    name: 'Work spots',
    items: [
      { shop_id: SHOP_ID_1, added_at: '2026-01-15T10:00:00Z' },
      { shop_id: SHOP_ID_2, added_at: '2026-01-15T11:00:00Z' },
    ],
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  },
  {
    id: LIST_ID_2,
    user_id: USER_ID,
    name: 'Date night',
    items: [{ shop_id: SHOP_ID_3, added_at: '2026-01-16T10:00:00Z' }],
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-01-16T10:00:00Z',
  },
];

describe('useUserLists', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => LISTS_RESPONSE,
    });
  });

  it('a shop saved to any list shows as saved on the bookmark button', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));
    expect(result.current.isSaved(SHOP_ID_1)).toBe(true);
    expect(result.current.isSaved(SHOP_ID_3)).toBe(true);
    expect(result.current.isSaved('d5e6f7a8-9012-4bcd-ef01-567890123456')).toBe(
      false
    );
  });

  it('a shop in list A does not show as saved in list B', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));
    expect(result.current.isInList(LIST_ID_1, SHOP_ID_1)).toBe(true);
    expect(result.current.isInList(LIST_ID_1, SHOP_ID_3)).toBe(false);
    expect(result.current.isInList(LIST_ID_2, SHOP_ID_3)).toBe(true);
  });

  it('when a user creates a new list it is sent to the API', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'e5f6a7b8-9abc-4ef0-d123-456789012345',
        name: 'New',
      }),
    });

    await act(async () => {
      await result.current.createList('New');
    });

    const postCall = mockFetch.mock.calls.find(
      (c) => c[1]?.method === 'POST' && c[0] === '/api/lists'
    );
    expect(postCall).toBeDefined();
  });

  it('when a user saves a shop to a list the API is called with the shop id', async () => {
    const newShopId = 'd4e5f6a7-8901-4bcd-ef01-456789012345';
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ list_id: LIST_ID_1, shop_id: newShopId }),
    });

    await act(async () => {
      await result.current.saveShop(LIST_ID_1, newShopId);
    });

    const postCall = mockFetch.mock.calls.find(
      (c) => c[1]?.method === 'POST' && c[0] === `/api/lists/${LIST_ID_1}/shops`
    );
    expect(postCall).toBeDefined();
  });

  it('when a user removes a shop from a list the DELETE API is called', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await act(async () => {
      await result.current.removeShop(LIST_ID_1, SHOP_ID_1);
    });

    const deleteCall = mockFetch.mock.calls.find(
      (c) =>
        c[1]?.method === 'DELETE' &&
        c[0] === `/api/lists/${LIST_ID_1}/shops/${SHOP_ID_1}`
    );
    expect(deleteCall).toBeDefined();
  });

  it('when saving a shop fails the optimistic update is rolled back', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    const originalItemCount =
      result.current.lists.find((l) => l.id === LIST_ID_1)?.items.length ?? 0;

    // API call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Server error' }),
    });

    await act(async () => {
      await expect(
        result.current.saveShop(LIST_ID_1, 'new-shop-id')
      ).rejects.toThrow();
    });

    await waitFor(() => {
      const itemCount =
        result.current.lists.find((l) => l.id === LIST_ID_1)?.items.length ?? 0;
      expect(itemCount).toBe(originalItemCount);
    });
  });

  it('when a user rapidly saves then removes a shop both operations complete and the shop is not saved', async () => {
    const newShopId = 'd4e5f6a7-8901-4bcd-ef01-456789012346';
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list_id: LIST_ID_1,
          shop_id: newShopId,
          added_at: '2026-01-20T12:00:00Z',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    await act(async () => {
      await Promise.all([
        result.current.saveShop(LIST_ID_1, newShopId),
        result.current.removeShop(LIST_ID_1, newShopId),
      ]);
    });

    await waitFor(() => {
      expect(result.current.isSaved(newShopId)).toBe(false);
    });
  });

  it('when a user with 3 lists tries to create a 4th the cap error is propagated to the caller', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Maximum of 3 lists allowed' }),
    });

    await act(async () => {
      await expect(result.current.createList('Fourth List')).rejects.toThrow(
        'Maximum'
      );
    });
  });

  it('when a user renames a list the new name is visible before the API responds', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    let resolveRename!: (val: unknown) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRename = resolve;
        })
    );

    // Trigger rename — the synchronous optimistic mutate runs before the first await
    act(() => {
      void result.current.renameList(LIST_ID_1, 'Night spots');
    });

    // Optimistic update must be visible before the API call settles
    await waitFor(() => {
      expect(result.current.lists.find((l) => l.id === LIST_ID_1)?.name).toBe(
        'Night spots'
      );
    });

    // Resolve the hanging call to avoid unfinished-promise warnings
    await act(async () => {
      resolveRename({
        ok: true,
        json: async () => ({ id: LIST_ID_1, name: 'Night spots' }),
      });
    });
  });
});
