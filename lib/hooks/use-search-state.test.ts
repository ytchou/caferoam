import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
}));

import { useSearchState } from "./use-search-state";

describe("useSearchState", () => {
  beforeEach(() => {
    mockPush.mockClear();
    // Reset search params
    mockSearchParams.delete("q");
    mockSearchParams.delete("mode");
    mockSearchParams.delete("filters");
  });

  it("reads query from ?q= URL param", () => {
    mockSearchParams.set("q", "espresso bar");
    const { result } = renderHook(() => useSearchState());
    expect(result.current.query).toBe("espresso bar");
  });

  it("reads mode from ?mode= URL param", () => {
    mockSearchParams.set("mode", "work");
    const { result } = renderHook(() => useSearchState());
    expect(result.current.mode).toBe("work");
  });

  it("reads filters from ?filters= URL param as array", () => {
    mockSearchParams.set("filters", "outlet,wifi");
    const { result } = renderHook(() => useSearchState());
    expect(result.current.filters).toEqual(["outlet", "wifi"]);
  });

  it("returns empty defaults when no params present", () => {
    const { result } = renderHook(() => useSearchState());
    expect(result.current.query).toBe("");
    expect(result.current.mode).toBeNull();
    expect(result.current.filters).toEqual([]);
  });

  it("setQuery updates q param", () => {
    const { result } = renderHook(() => useSearchState());
    act(() => {
      result.current.setQuery("cappuccino");
    });
    expect(mockPush).toHaveBeenCalled();
    const calledUrl = mockPush.mock.calls[0][0] as string;
    expect(calledUrl).toContain("q=cappuccino");
  });

  it("clearAll removes all search params", () => {
    mockSearchParams.set("q", "latte");
    mockSearchParams.set("mode", "work");
    const { result } = renderHook(() => useSearchState());
    act(() => {
      result.current.clearAll();
    });
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\//));
  });
});
