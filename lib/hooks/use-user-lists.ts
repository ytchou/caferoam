'use client';

import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { fetchWithAuth } from '@/lib/api/fetch';
import type { List } from '@/lib/types';

const fetcher = (url: string) => fetchWithAuth(url);

export function useUserLists() {
  const { data: lists, error, isLoading, mutate } = useSWR<List[]>(
    '/api/lists',
    fetcher
  );

  const { savedShopIds, listMembership } = useMemo(() => {
    const saved = new Set<string>();
    const membership = new Map<string, Set<string>>();
    for (const list of lists ?? []) {
      const shopIds = new Set(list.items.map((i) => i.shop_id));
      for (const id of shopIds) saved.add(id);
      membership.set(list.id, shopIds);
    }
    return { savedShopIds: saved, listMembership: membership };
  }, [lists]);

  const isSaved = useCallback(
    (shopId: string) => savedShopIds.has(shopId),
    [savedShopIds]
  );

  const isInList = useCallback(
    (listId: string, shopId: string) =>
      listMembership.get(listId)?.has(shopId) ?? false,
    [listMembership]
  );

  const saveShop = useCallback(
    async (listId: string, shopId: string) => {
      const prev = lists;
      mutate(
        lists?.map((l) =>
          l.id === listId
            ? {
                ...l,
                items: [
                  ...l.items,
                  { shop_id: shopId, added_at: new Date().toISOString() },
                ],
              }
            : l
        ),
        false
      );
      try {
        await fetchWithAuth(`/api/lists/${listId}/shops`, {
          method: 'POST',
          body: JSON.stringify({ shop_id: shopId }),
        });
        mutate();
      } catch {
        mutate(prev, false);
        throw new Error('Failed to save shop');
      }
    },
    [lists, mutate]
  );

  const removeShop = useCallback(
    async (listId: string, shopId: string) => {
      const prev = lists;
      mutate(
        lists?.map((l) =>
          l.id === listId
            ? { ...l, items: l.items.filter((i) => i.shop_id !== shopId) }
            : l
        ),
        false
      );
      try {
        await fetchWithAuth(`/api/lists/${listId}/shops/${shopId}`, {
          method: 'DELETE',
        });
        mutate();
      } catch {
        mutate(prev, false);
        throw new Error('Failed to remove shop');
      }
    },
    [lists, mutate]
  );

  const createList = useCallback(
    async (name: string) => {
      await fetchWithAuth('/api/lists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      mutate();
    },
    [mutate]
  );

  const deleteList = useCallback(
    async (listId: string) => {
      const prev = lists;
      mutate(
        lists?.filter((l) => l.id !== listId),
        false
      );
      try {
        await fetchWithAuth(`/api/lists/${listId}`, {
          method: 'DELETE',
        });
        mutate();
      } catch {
        mutate(prev, false);
        throw new Error('Failed to delete list');
      }
    },
    [lists, mutate]
  );

  const renameList = useCallback(
    async (listId: string, name: string) => {
      const prev = lists;
      mutate(
        lists?.map((l) => (l.id === listId ? { ...l, name } : l)),
        false
      );
      try {
        await fetchWithAuth(`/api/lists/${listId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        });
        mutate();
      } catch {
        mutate(prev, false);
        throw new Error('Failed to rename list');
      }
    },
    [lists, mutate]
  );

  return {
    lists: lists ?? [],
    isLoading,
    error,
    isSaved,
    isInList,
    saveShop,
    removeShop,
    createList,
    deleteList,
    renameList,
  };
}
