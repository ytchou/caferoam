import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  }),
}));

const mockCapture = vi.fn();
vi.mock('@/lib/posthog/use-analytics', () => ({
  useAnalytics: () => ({ capture: mockCapture }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { SessionTracker } from '../session-tracker';

describe('SessionTracker', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockCapture.mockReset();
  });

  it('calls heartbeat endpoint and fires session_start event on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        days_since_first_session: 3,
        previous_sessions: 5,
      }),
    });

    render(<SessionTracker />);

    await waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith('session_start', {
        days_since_first_session: 3,
        previous_sessions: 5,
      });
    });
  });

  it('does not fire event when heartbeat request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Unauthorized' }),
    });

    render(<SessionTracker />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
