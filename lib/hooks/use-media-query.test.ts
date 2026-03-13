import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useIsDesktop, useMediaQuery } from "./use-media-query";

describe("useMediaQuery", () => {
  const mockMatchMedia = (matches: boolean) => {
    const listeners: EventListener[] = [];
    return vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (type: string, listener: EventListener) => {
        listeners.push(listener);
      },
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  };

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia(false),
    });
  });

  it("returns false when media query does not match", () => {
    const { result } = renderHook(() =>
      useMediaQuery("(min-width: 1024px)")
    );
    expect(result.current).toBe(false);
  });

  it("returns true when media query matches", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia(true),
    });
    const { result } = renderHook(() =>
      useMediaQuery("(min-width: 1024px)")
    );
    expect(result.current).toBe(true);
  });
});

describe("useIsDesktop", () => {
  it("returns false on mobile viewport", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });

  it("returns true on desktop viewport", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });
});
