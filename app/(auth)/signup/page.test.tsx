import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseAuth } from '@/lib/test-utils/mocks';

const mockAuth = createMockSupabaseAuth();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: mockAuth }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import SignupPage from './page';

describe('/signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email, password, and PDPA consent checkbox', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/privacy policy/i)).toBeInTheDocument();
  });

  it('submit button is disabled until PDPA checkbox is checked', () => {
    render(<SignupPage />);
    expect(screen.getByRole('button', { name: /sign up/i })).toBeDisabled();
  });

  it('user can sign up after checking PDPA consent and sees email confirmation', async () => {
    mockAuth.signUp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), 'new.user@gmail.com');
    await user.type(screen.getByLabelText(/password/i), 'strong-pass-456');
    await user.click(screen.getByLabelText(/privacy policy/i));
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      expect(screen.getByText('new.user@gmail.com')).toBeInTheDocument();
    });

    expect(mockAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.user@gmail.com',
        password: 'strong-pass-456',
        options: expect.objectContaining({
          data: expect.objectContaining({
            pdpa_consented: true,
          }),
        }),
      })
    );
  });

  it('shows error message when signup fails', async () => {
    mockAuth.signUp.mockResolvedValue({
      error: { message: 'User already registered' },
    });
    const user = userEvent.setup();
    render(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), 'existing@gmail.com');
    await user.type(screen.getByLabelText(/password/i), 'any-password');
    await user.click(screen.getByLabelText(/privacy policy/i));
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'User already registered'
      );
    });
  });
});
