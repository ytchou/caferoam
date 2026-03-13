'use client';
import useSWR from 'swr';
import { fetchPublic } from '@/lib/api/fetch';
import type { Shop } from '@/lib/types';

interface UseShopsOptions {
  featured?: boolean;
  limit?: number;
}

export function useShops(options: UseShopsOptions = {}) {
  const { featured, limit = 12 } = options;
  const params = new URLSearchParams();
  if (featured) params.set('featured', 'true');
  params.set('limit', String(limit));

  const { data, isLoading, error } = useSWR<Shop[]>(
    `/api/shops?${params.toString()}`,
    fetchPublic,
    { revalidateOnFocus: false }
  );

  return {
    shops: data ?? [],
    isLoading,
    error: error ?? null,
  };
}
