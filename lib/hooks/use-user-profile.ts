'use client';

import useSWR from 'swr';
import { fetchWithAuth } from '@/lib/api/fetch';

export interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  stamp_count: number;
  checkin_count: number;
}

export function useUserProfile() {
  const { data, error, isLoading, mutate } = useSWR<ProfileData>(
    '/api/profile',
    fetchWithAuth
  );

  return {
    profile: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
