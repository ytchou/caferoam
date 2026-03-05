import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseAuth,
  createMockRouter,
} from '@/lib/test-utils/mocks';
import { makeSession } from '@/lib/test-utils/factories';

const mockAuth = createMockSupabaseAuth();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: mockAuth }),
}));

const mockRouter = createMockRouter();
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const testSession = makeSession();

import RecoverPage from './page';

describe('/account/recover page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getSession.mockResolvedValue({ data: { session: testSession } });
    mockAuth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });
  });

  it('renders account recovery info and cancel deletion button', () => {
    render(<RecoverPage />);
    expect(screen.getByText(/account recovery/i)).toBeInTheDocument();
    expect(screen.getByText(/30 days/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /cancel deletion/i })
    ).toBeInTheDocument();
  });

  it('user can cancel deletion and is redirected to home', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RecoverPage />);

    await user.click(
      screen.getByRole('button', { name: /cancel deletion/i })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/cancel-deletion',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${testSession.access_token}`,
          }),
        })
      );
      expect(mockAuth.refreshSession).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message when cancel-deletion API fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'No deletion request found' }),
    });
    const user = userEvent.setup();
    render(<RecoverPage />);

    await user.click(
      screen.getByRole('button', { name: /cancel deletion/i })
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No deletion request found'
      );
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('redirects to /login when no session exists', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    const user = userEvent.setup();
    render(<RecoverPage />);

    await user.click(
      screen.getByRole('button', { name: /cancel deletion/i })
    );

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
