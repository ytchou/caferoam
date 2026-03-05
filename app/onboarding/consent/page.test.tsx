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
  useSearchParams: () => new URLSearchParams(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const testSession = makeSession();

import ConsentPage from './page';

describe('/onboarding/consent page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getSession.mockResolvedValue({ data: { session: testSession } });
    mockAuth.refreshSession.mockResolvedValue({
      data: { session: {} },
      error: null,
    });
  });

  it('renders PDPA disclosure with data collection, purpose, and rights sections', () => {
    render(<ConsentPage />);
    expect(screen.getByText(/我們收集的資料/)).toBeInTheDocument();
    expect(screen.getByText(/使用目的/)).toBeInTheDocument();
    expect(screen.getByText(/您的權利/)).toBeInTheDocument();
  });

  it('confirm button is disabled until checkbox is checked', () => {
    render(<ConsentPage />);
    expect(screen.getByRole('button', { name: /確認並繼續/ })).toBeDisabled();
  });

  it('user can agree and submit consent, then is redirected to home', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ConsentPage />);

    await user.click(screen.getByLabelText(/我已閱讀並同意/));
    await user.click(screen.getByRole('button', { name: /確認並繼續/ }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/consent',
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

  it('shows error message when consent API fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Consent recording failed' }),
    });
    const user = userEvent.setup();
    render(<ConsentPage />);

    await user.click(screen.getByLabelText(/我已閱讀並同意/));
    await user.click(screen.getByRole('button', { name: /確認並繼續/ }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Consent recording failed'
      );
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('redirects to /login when no session exists', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    const user = userEvent.setup();
    render(<ConsentPage />);

    await user.click(screen.getByLabelText(/我已閱讀並同意/));
    await user.click(screen.getByRole('button', { name: /確認並繼續/ }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
