import { NextRequest } from 'next/server';
import { describe, it, expect, vi } from 'vitest';

const { mockProxyToBackend } = vi.hoisted(() => ({
  mockProxyToBackend: vi.fn(),
}));
vi.mock('@/lib/api/proxy', () => ({
  proxyToBackend: mockProxyToBackend,
}));

import { POST } from './route';

describe('session-heartbeat route', () => {
  it('proxies POST to the backend session-heartbeat endpoint', async () => {
    mockProxyToBackend.mockResolvedValue(
      new Response(
        JSON.stringify({ days_since_first_session: 3, previous_sessions: 5 }),
        {
          status: 200,
        }
      )
    );

    const req = new NextRequest('http://localhost/api/auth/session-heartbeat', {
      method: 'POST',
    });

    const res = await POST(req);

    expect(mockProxyToBackend).toHaveBeenCalledWith(
      req,
      '/auth/session-heartbeat'
    );
    expect(res.status).toBe(200);
  });
});
