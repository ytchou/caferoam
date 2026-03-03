import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SWRConfig } from 'swr';

const LIST_ID_1 = 'e3b0c442-98a1-441d-b22f-5a00bd8c3e1b';
const LIST_ID_2 = 'f4c1d553-a9b2-552e-c330-6b11ce9d4f2c';
const LIST_ID_3 = 'a7e8b9c0-d1f2-4a3b-8c5d-e6f7a8b9c0d1';
const USER_ID = 'c7d2a819-5e3f-4c8b-b6a0-1234567890ab';
const SHOP_ID_1 = 'a1b2c3d4-5678-90ab-cdef-1234567890ab';

const THREE_LISTS = [
  {
    id: LIST_ID_1,
    user_id: USER_ID,
    name: 'Work spots',
    items: [{ shop_id: SHOP_ID_1, added_at: '2026-01-15T10:00:00Z' }],
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  },
  {
    id: LIST_ID_2,
    user_id: USER_ID,
    name: 'Date night',
    items: [],
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-01-16T10:00:00Z',
  },
  {
    id: LIST_ID_3,
    user_id: USER_ID,
    name: 'Weekend',
    items: [],
    created_at: '2026-01-17T10:00:00Z',
    updated_at: '2026-01-17T10:00:00Z',
  },
];

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import ListsPage from './page';

describe('/lists page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => THREE_LISTS,
    });
  });

  it("a user's lists are shown on the page", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ListsPage />
      </SWRConfig>
    );
    expect(await screen.findByText('Work spots')).toBeInTheDocument();
    expect(await screen.findByText('Date night')).toBeInTheDocument();
    expect(await screen.findByText('Weekend')).toBeInTheDocument();
  });

  it('the 3/3 cap indicator is visible when the user is at the limit', async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ListsPage />
      </SWRConfig>
    );
    expect(await screen.findByText(/3.*\/.*3|3\s*\/\s*3/)).toBeInTheDocument();
  });

  it('create list input is not shown when the user is at the 3-list cap', async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ListsPage />
      </SWRConfig>
    );
    // Wait for lists to load, then verify no create input
    await screen.findByText('Work spots');
    expect(
      screen.queryByPlaceholderText(/create new list/i)
    ).not.toBeInTheDocument();
  });

  it('map pins are not fetched when the lists page first loads', async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ListsPage />
      </SWRConfig>
    );
    await screen.findByText('Work spots');
    await waitFor(() => {
      const pinsFetch = mockFetch.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('/pins')
      );
      expect(pinsFetch).toBeUndefined();
    });
  });
});
