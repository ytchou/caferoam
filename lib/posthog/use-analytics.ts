'use client';

import { useCallback } from 'react';
import posthog from 'posthog-js';

export function useAnalytics() {
  const capture = useCallback(
    (event: string, properties: Record<string, unknown>) => {
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (!key) return;

      posthog.capture(event, properties);
    },
    []
  );

  return { capture };
}
