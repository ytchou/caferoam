import { SWRConfig } from 'swr';
import React from 'react';

/**
 * Returns a wrapper component that isolates SWR cache between tests.
 *
 * @example
 * const wrapper = createSWRWrapper();
 * renderHook(() => useMyHook(), { wrapper });
 */
export function createSWRWrapper() {
  return function SWRWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      SWRConfig,
      { value: { provider: () => new Map() } },
      children
    );
  };
}
