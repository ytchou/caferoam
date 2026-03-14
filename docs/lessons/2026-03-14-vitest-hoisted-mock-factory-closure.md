# vi.mock() factory closures require vi.hoisted() for referenced variables

**Date:** 2026-03-14
**Context:** `components/shops/recent-checkins-strip.test.tsx` declared `mockGetUser` and `mockOnAuthStateChange` as plain module-level `const`, then referenced them inside a `vi.mock()` factory closure.

**What happened:** Vitest hoists all `vi.mock()` calls to the top of the file before any other statements, including `const` declarations. When the factory executes, `mockGetUser` is in the temporal dead zone (TDZ) — it hasn't been initialized yet. This causes `undefined` references inside the factory, making the mock wiring silently broken.

**Root cause:** The Vitest hoisting transform moves `vi.mock(...)` physically above `const` declarations. Variables declared with `const`/`let` are not accessible before their declaration line (TDZ), so the factory function captures `undefined`.

**Prevention:** Any variable used inside a `vi.mock()` factory must be declared via `vi.hoisted()`:

```tsx
const { mockFn } = vi.hoisted(() => ({
  mockFn: vi.fn(),
}));

vi.mock('@/lib/some-module', () => ({
  someExport: mockFn, // safe — vi.hoisted() runs before the factory
}));
```

`vi.hoisted()` is itself hoisted, so its return value is available when the `vi.mock()` factory runs. Plain `const` declarations are not.

Rule: **If you need a `vi.fn()` spy inside a `vi.mock()` factory, always declare it with `vi.hoisted()`.**
