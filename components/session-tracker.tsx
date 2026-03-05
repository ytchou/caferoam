'use client';

import { useEffect, useRef } from 'react';
import { useAnalytics } from '@/lib/posthog/use-analytics';
import { createClient } from '@/lib/supabase/client';
import { fetchWithAuth } from '@/lib/api/fetch';

export function SessionTracker() {
  const { capture } = useAnalytics();
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;

    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;

      fetchWithAuth('/api/auth/session-heartbeat', { method: 'POST' })
        .then(
          (result: { days_since_first_session: number; previous_sessions: number }) => {
            capture('session_start', {
              days_since_first_session: result.days_since_first_session,
              previous_sessions: result.previous_sessions,
            });
          }
        )
        .catch(() => {});
    });
  }, [capture]);

  return null;
}
