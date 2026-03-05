'use client';

import { useEffect, useRef } from 'react';
import { useAnalytics } from '@/lib/posthog/use-analytics';
import { fetchWithAuth } from '@/lib/api/fetch';

export function SessionTracker() {
  const { capture } = useAnalytics();
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;

    fetchWithAuth('/api/auth/session-heartbeat', { method: 'POST' })
      .then(
        (data: { days_since_first_session: number; previous_sessions: number }) => {
          capture('session_start', {
            days_since_first_session: data.days_since_first_session,
            previous_sessions: data.previous_sessions,
          });
        }
      )
      .catch(() => {
        // Silently ignore — user may not be authenticated yet
      });
  }, [capture]);

  return null;
}
