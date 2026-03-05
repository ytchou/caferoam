import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SWRConfig } from 'swr';
import React from 'react';
import {
  createMockSupabaseAuth,
  createMockRouter,
} from '@/lib/test-utils/mocks';
import { makeSession } from '@/lib/test-utils/factories';

const mockAuth = createMockSupabaseAuth();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: mockAuth, storage: { from: mockStorageFrom } }),
}));

const mockRouter = createMockRouter();
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const testSession = makeSession();

import SettingsPage from './page';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getSession.mockResolvedValue({ data: { session: testSession } });
    mockAuth.signOut.mockResolvedValue({});
  });

  it('renders logout button and danger zone', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    expect(screen.getByText(/danger zone/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete account/i })
    ).toBeInTheDocument();
  });

  it('user can log out and is redirected to the home page', async () => {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(mockAuth.signOut).toHaveBeenCalledOnce();
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/'));
  });

  it('shows confirmation dialog when delete account is clicked', async () => {
    render(<SettingsPage />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete account/i })
    );
    expect(screen.getByPlaceholderText(/type delete/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /confirm delete/i })
    ).toBeDisabled();
  });

  it('confirm delete button remains disabled until "DELETE" is typed', async () => {
    render(<SettingsPage />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete account/i })
    );

    const input = screen.getByPlaceholderText(/type delete/i);
    const confirmBtn = screen.getByRole('button', { name: /confirm delete/i });

    await userEvent.type(input, 'DELET');
    expect(confirmBtn).toBeDisabled();

    await userEvent.type(input, 'E');
    expect(confirmBtn).not.toBeDisabled();
  });

  it('user can request account deletion and is signed out', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    render(<SettingsPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /delete account/i })
    );
    await userEvent.type(screen.getByPlaceholderText(/type delete/i), 'DELETE');
    await userEvent.click(
      screen.getByRole('button', { name: /confirm delete/i })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/account',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${testSession.access_token}`,
          }),
        })
      );
      expect(mockAuth.signOut).toHaveBeenCalledOnce();
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message when API call fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Server error' }),
    });
    render(<SettingsPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /delete account/i })
    );
    await userEvent.type(screen.getByPlaceholderText(/type delete/i), 'DELETE');
    await userEvent.click(
      screen.getByRole('button', { name: /confirm delete/i })
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('cancel button closes dialog without deleting', async () => {
    render(<SettingsPage />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete account/i })
    );
    expect(screen.getByPlaceholderText(/type delete/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(
      screen.queryByPlaceholderText(/type delete/i)
    ).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/auth/account',
      expect.anything()
    );
  });

  it('redirects to /login when session is null without calling API', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    render(<SettingsPage />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete account/i })
    );
    await userEvent.type(screen.getByPlaceholderText(/type delete/i), 'DELETE');
    await userEvent.click(
      screen.getByRole('button', { name: /confirm delete/i })
    );
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/login'));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    SWRConfig,
    { value: { provider: () => new Map() } },
    children
  );
}

describe('Profile editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getSession.mockResolvedValue({ data: { session: testSession } });
    mockAuth.signOut.mockResolvedValue({});
    // Mock GET /api/profile for the initial load
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (
        typeof url === 'string' &&
        url.includes('/api/profile') &&
        (!init || init.method !== 'PATCH')
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            display_name: 'Mei-Ling',
            avatar_url: null,
            stamp_count: 0,
            checkin_count: 0,
          }),
        });
      }
      if (
        typeof url === 'string' &&
        url.includes('/api/profile') &&
        init?.method === 'PATCH'
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ message: 'Profile updated' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders display name input with current value', async () => {
    render(<SettingsPage />, { wrapper });
    await waitFor(() => {
      const input = screen.getByLabelText(/display name/i);
      expect(input).toHaveValue('Mei-Ling');
    });
  });

  it('saves updated display name on submit', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/display name/i);
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profile'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  it('rejects non-image files with an error message', async () => {
    render(<SettingsPage />, { wrapper });
    const fileInput = screen.getByRole('button', { name: /upload photo/i })
      .parentElement!.querySelector('input[type="file"]')!;

    const pdfFile = new File(['content'], 'document.pdf', {
      type: 'application/pdf',
    });
    await userEvent.upload(fileInput, pdfFile);

    await waitFor(() => {
      expect(screen.getByText(/file must be an image/i)).toBeInTheDocument();
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects images over 1MB with an error message', async () => {
    render(<SettingsPage />, { wrapper });
    const fileInput = screen.getByRole('button', { name: /upload photo/i })
      .parentElement!.querySelector('input[type="file"]')!;

    const largeFile = new File(
      [new ArrayBuffer(1024 * 1024 + 1)],
      'large-photo.jpg',
      { type: 'image/jpeg' }
    );
    await userEvent.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/under 1MB/i)).toBeInTheDocument();
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('uploads valid avatar image and shows Save changes button', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          'http://127.0.0.1:54321/storage/v1/object/public/avatars/user-123/avatar',
      },
    });
    render(<SettingsPage />, { wrapper });
    const fileInput = screen.getByRole('button', { name: /upload photo/i })
      .parentElement!.querySelector('input[type="file"]')!;

    const avatarFile = new File(['img'], 'selfie.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, avatarFile);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining('/avatar'),
        avatarFile,
        expect.objectContaining({ upsert: true, contentType: 'image/jpeg' })
      );
    });
    // Save button re-enables after upload completes
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /save changes/i })
      ).not.toBeDisabled();
    });
  });
});
