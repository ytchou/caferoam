'use client';

import useSWR from 'swr';
import { fetchWithAuth } from '@/lib/api/fetch';

export interface CheckInData {
  id: string;
  user_id: string;
  shop_id: string;
  shop_name: string | null; // null if shop was deleted
  shop_mrt: string | null;
  photo_urls: string[];
  stars: number | null;
  review_text: string | null;
  created_at: string;
}

export function useUserCheckins() {
  const { data, error, isLoading, mutate } = useSWR<CheckInData[]>(
    '/api/checkins',
    fetchWithAuth
  );

  return {
    checkins: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
