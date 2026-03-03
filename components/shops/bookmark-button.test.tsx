import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SWRConfig } from 'swr';

const LIST_ID_1 = 'e3b0c442-98a1-441d-b22f-5a00bd8c3e1b';
const USER_ID = 'c7d2a819-5e3f-4c8b-b6a0-1234567890ab';
const SHOP_ID_1 = 'a1b2c3d4-5678-90ab-cdef-1234567890ab';

// Mock supabase auth — stays as auth boundary mock
const mockGetSession = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => `/shops/${SHOP_ID_1}`,
}));

// Mock vaul/drawer — render children directly in jsdom
vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DrawerContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DrawerFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerClose: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { BookmarkButton } from './bookmark-button';

describe('BookmarkButton', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockPush.mockReset();
  });

  it('renders filled icon when shop is saved', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: LIST_ID_1,
          user_id: USER_ID,
          name: 'Work spots',
          items: [{ shop_id: SHOP_ID_1, added_at: '2026-01-15T10:00:00Z' }],
          created_at: '2026-01-15T10:00:00Z',
          updated_at: '2026-01-15T10:00:00Z',
        },
      ],
    });
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <BookmarkButton shopId={SHOP_ID_1} />
      </SWRConfig>
    );
    expect(
      await screen.findByRole('button', { name: /saved/i })
    ).toBeInTheDocument();
  });

  it('renders empty icon when shop is not saved', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: LIST_ID_1,
          user_id: USER_ID,
          name: 'Work spots',
          items: [],
          created_at: '2026-01-15T10:00:00Z',
          updated_at: '2026-01-15T10:00:00Z',
        },
      ],
    });
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <BookmarkButton shopId={SHOP_ID_1} />
      </SWRConfig>
    );
    expect(
      await screen.findByRole('button', { name: /save to list/i })
    ).toBeInTheDocument();
  });

  it('redirects to login when unauthenticated user clicks', async () => {
    // fetchWithAuth throws before even calling fetch when no session
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <BookmarkButton shopId={SHOP_ID_1} />
      </SWRConfig>
    );
    const button = await screen.findByRole('button', { name: /save to list/i });
    await userEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/login'));
  });
});
