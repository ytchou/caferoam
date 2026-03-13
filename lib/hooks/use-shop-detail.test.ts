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

import { useShopDetail } from "./use-shop-detail";

const MOCK_SHOP = {
  id: "shop-001",
  name: "山小孩咖啡",
  slug: "shan-xiao-hai-ka-fei",
  address: "台北市大安區復興南路一段107巷5弄8號",
  latitude: 25.033,
  longitude: 121.543,
  rating: 4.6,
  review_count: 287,
  photo_urls: ["https://example.com/photo1.jpg"],
  taxonomy_tags: [{ id: "quiet", dimension: "ambience", label: "Quiet", label_zh: "安靜" }],
  mode_scores: { work: 0.8, rest: 0.6, social: 0.3 },
};

describe("useShopDetail", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("fetches shop detail and returns data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_SHOP,
    });
    const { result } = renderHook(() => useShopDetail("shop-001"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.shop).not.toBeNull());
    expect(result.current.shop?.name).toBe("山小孩咖啡");
    expect(result.current.shop?.slug).toBe("shan-xiao-hai-ka-fei");
  });

  it("returns null shop while loading", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useShopDetail("shop-001"), {
      wrapper: createWrapper(),
    });
    expect(result.current.shop).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const { result } = renderHook(() => useShopDetail("shop-001"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});
