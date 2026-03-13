import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { SWRConfig } from "swr";

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

const createWrapper = () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(SWRConfig, { value: { provider: () => new Map() } }, children);
  Wrapper.displayName = "SWRWrapper";
  return Wrapper;
};

import { useShops } from "./use-shops";

const MOCK_SHOPS = [
  { id: "shop-001", name: "山小孩咖啡", slug: "shan-xiao-hai-ka-fei", rating: 4.6 },
  { id: "shop-002", name: "好咖啡", slug: "hao-ka-fei", rating: 4.2 },
];

describe("useShops", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("fetches featured shops", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ shops: MOCK_SHOPS }),
    });
    const { result } = renderHook(() => useShops({ featured: true, limit: 12 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.shops).toHaveLength(2));
    expect(result.current.shops[0].name).toBe("山小孩咖啡");
  });

  it("returns empty array while loading", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useShops({ featured: true }), {
      wrapper: createWrapper(),
    });
    expect(result.current.shops).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("handles error state", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const { result } = renderHook(() => useShops({ featured: true }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});
