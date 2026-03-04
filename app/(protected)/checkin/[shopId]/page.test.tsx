import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Stub browser APIs missing in jsdom
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock next/navigation
const mockBack = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useParams: () => ({ shopId: 'shop-d4e5f6' }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: 'test-token', user: { id: 'user-abc' } },
        },
      }),
    },
    storage: {
      from: () => ({
        upload: vi
          .fn()
          .mockResolvedValue({
            data: { path: 'user-abc/photo.webp' },
            error: null,
          }),
        getPublicUrl: () => ({
          data: {
            publicUrl:
              'https://example.supabase.co/storage/v1/object/public/checkin-photos/user-abc/photo.webp',
          },
        }),
      }),
    },
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import CheckInPage from './page';

describe('CheckInPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockBack.mockReset();
    // Mock shop fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'shop-d4e5f6', name: '山小孩咖啡' }),
    });
  });

  it('shows the shop name and a disabled submit button initially', async () => {
    render(<CheckInPage />);
    expect(await screen.findByText(/山小孩咖啡/)).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: /check in/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button after selecting a photo', async () => {
    render(<CheckInPage />);
    await screen.findByText(/山小孩咖啡/);

    const input = screen.getByTestId('photo-input');
    const file = new File(['photo'], 'latte.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);

    const submitBtn = screen.getByRole('button', { name: /check in/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('on successful submit, calls the check-in API and navigates back', async () => {
    // Mock successful check-in POST (shop fetch already queued in beforeEach)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'ci-1',
        shop_id: 'shop-d4e5f6',
        photo_urls: [
          'https://example.supabase.co/storage/v1/object/public/checkin-photos/user-abc/photo.webp',
        ],
        created_at: '2026-03-04T10:00:00Z',
      }),
    });

    render(<CheckInPage />);
    await screen.findByText(/山小孩咖啡/);

    const input = screen.getByTestId('photo-input');
    const file = new File(['photo'], 'latte.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);

    const submitBtn = screen.getByRole('button', { name: /check in/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(
        (c) => c[0] === '/api/checkins' && c[1]?.method === 'POST'
      );
      expect(postCall).toBeDefined();
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('shows PDPA disclosure in the menu photo section', async () => {
    render(<CheckInPage />);
    await screen.findByText(/山小孩咖啡/);
    expect(screen.getByText(/improve shop information/i)).toBeInTheDocument();
  });
});
