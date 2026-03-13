"use client";
import useSWR from "swr";
import type { Shop } from "@/lib/types";

interface UseShopsOptions {
  featured?: boolean;
  limit?: number;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useShops(options: UseShopsOptions = {}) {
  const { featured, limit = 12 } = options;
  const params = new URLSearchParams();
  if (featured) params.set("featured", "true");
  params.set("limit", String(limit));

  const { data, isLoading, error } = useSWR<{ shops: Shop[] }>(
    `/api/shops?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    shops: data?.shops ?? [],
    isLoading,
    error: error ?? null,
  };
}
