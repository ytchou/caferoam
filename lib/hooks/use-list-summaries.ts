'use client';

import useSWR from 'swr';
import { fetchWithAuth } from '@/lib/api/fetch';

export interface ListSummaryData {
  id: string;
  name: string;
  shop_count: number;
  preview_photos: string[];
}

export function useListSummaries() {
  const { data, error, isLoading } = useSWR<ListSummaryData[]>(
    '/api/lists/summaries',
    fetchWithAuth
  );

  return {
    lists: data ?? [],
    isLoading,
    error,
  };
}
