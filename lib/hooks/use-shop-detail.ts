"use client";
import useSWR from "swr";

async function fetchShopDetail(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useShopDetail(shopId: string | null) {
  const { data, isLoading, error } = useSWR(
    shopId ? `/api/shops/${shopId}` : null,
    fetchShopDetail,
    { revalidateOnFocus: false }
  );

  return {
    shop: data ?? null,
    isLoading,
    error: error ?? null,
  };
}
