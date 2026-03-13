'use client';
import useSWR from 'swr';
import { fetchPublic } from '@/lib/api/fetch';
import type { ShopDetail } from '@/lib/types';

export function useShopDetail(shopId: string | null) {
  const { data, isLoading, error } = useSWR<ShopDetail>(
    shopId ? `/api/shops/${shopId}` : null,
    fetchPublic,
    { revalidateOnFocus: false }
  );

  return {
    shop: data ?? null,
    isLoading,
    error: error ?? null,
  };
}
