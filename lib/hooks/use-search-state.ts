"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export type SearchMode = "work" | "rest" | "social" | "specialty" | null;

export interface SearchState {
  query: string;
  mode: SearchMode;
  filters: string[];
  setQuery: (q: string) => void;
  setMode: (mode: SearchMode) => void;
  toggleFilter: (filter: string) => void;
  clearAll: () => void;
}

export function useSearchState(): SearchState {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = searchParams.get("q") ?? "";
  const mode = (searchParams.get("mode") as SearchMode) ?? null;
  const filtersRaw = searchParams.get("filters");
  const filters = useMemo(
    () => (filtersRaw ? filtersRaw.split(",").filter(Boolean) : []),
    [filtersRaw]
  );

  const buildUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [searchParams, pathname]
  );

  const setQuery = useCallback(
    (q: string) => {
      router.push(buildUrl({ q: q || null }));
    },
    [router, buildUrl]
  );

  const setMode = useCallback(
    (m: SearchMode) => {
      router.push(buildUrl({ mode: m }));
    },
    [router, buildUrl]
  );

  const toggleFilter = useCallback(
    (filter: string) => {
      const next = filters.includes(filter)
        ? filters.filter((f) => f !== filter)
        : [...filters, filter];
      router.push(buildUrl({ filters: next.join(",") || null }));
    },
    [router, buildUrl, filters]
  );

  const clearAll = useCallback(() => {
    router.push(buildUrl({ q: null, mode: null, filters: null }));
  }, [router, buildUrl]);

  return { query, mode, filters, setQuery, setMode, toggleFilter, clearAll };
}
