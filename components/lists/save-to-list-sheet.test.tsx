import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SWRConfig } from 'swr';

const LIST_ID_1 = 'e3b0c442-98a1-441d-b22f-5a00bd8c3e1b';
const LIST_ID_2 = 'f4c1d553-a9b2-552e-c330-6b11ce9d4f2c';
const LIST_ID_3 = 'a7e8b9c0-d1f2-4a3b-8c5d-e6f7a8b9c0d1';
const USER_ID = 'c7d2a819-5e3f-4c8b-b6a0-1234567890ab';
const SHOP_ID_1 = 'a1b2c3d4-5678-90ab-cdef-1234567890ab';
const SHOP_ID_2 = 'b2c3d4e5-6789-01bc-def0-2345678901bc';
const SHOP_ID_3 = 'c3d4e5f6-789a-12cd-ef01-3456789012cd';

const TWO_LISTS = [
  {
    id: LIST_ID_1,
    user_id: USER_ID,
    name: 'Work spots',
    items: [
      { shop_id: SHOP_ID_1, added_at: '2026-01-15T10:00:00Z' },
      { shop_id: SHOP_ID_2, added_at: '2026-01-15T11:00:00Z' },
    ],
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  },
  {
    id: LIST_ID_2,
    user_id: USER_ID,
    name: 'Date night',
    items: [{ shop_id: SHOP_ID_3, added_at: '2026-01-16T10:00:00Z' }],
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-01-16T10:00:00Z',
  },
];

const THREE_LISTS = [
  ...TWO_LISTS,
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

import { SaveToListSheet } from './save-to-list-sheet';

describe('SaveToListSheet', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => TWO_LISTS,
    });
  });

  it('lists containing the shop show as checked', async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <SaveToListSheet
          shopId={SHOP_ID_1}
          open={true}
          onOpenChange={vi.fn()}
        />
      </SWRConfig>
    );
    const workCheckbox = await screen.findByRole('checkbox', {
      name: /work spots/i,
    });
    const dateCheckbox = await screen.findByRole('checkbox', {
      name: /date night/i,
    });
    expect(workCheckbox).toBeChecked();
    expect(dateCheckbox).not.toBeChecked();
  });

  it('when a user checks an unchecked list the shop is saved to it', async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <SaveToListSheet
          shopId={SHOP_ID_1}
          open={true}
          onOpenChange={vi.fn()}
        />
      </SWRConfig>
    );
    const dateCheckbox = await screen.findByRole('checkbox', {
      name: /date night/i,
    });
    await userEvent.click(dateCheckbox);
    await waitFor(() => {
      const saveCall = mockFetch.mock.calls.find(
        (c) =>
          c[1]?.method === 'POST' && c[0] === `/api/lists/${LIST_ID_2}/shops`
      );
      expect(saveCall).toBeDefined();
    });
  });

  it('when a user unchecks a checked list the shop is removed from it', async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <SaveToListSheet
          shopId={SHOP_ID_1}
          open={true}
          onOpenChange={vi.fn()}
        />
      </SWRConfig>
    );
    const workCheckbox = await screen.findByRole('checkbox', {
      name: /work spots/i,
    });
    await userEvent.click(workCheckbox);
    await waitFor(() => {
      const removeCall = mockFetch.mock.calls.find(
        (c) =>
          c[1]?.method === 'DELETE' &&
          c[0] === `/api/lists/${LIST_ID_1}/shops/${SHOP_ID_1}`
      );
      expect(removeCall).toBeDefined();
    });
  });

  it('create new list input is shown when the user has fewer than 3 lists', async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <SaveToListSheet
          shopId={SHOP_ID_1}
          open={true}
          onOpenChange={vi.fn()}
        />
      </SWRConfig>
    );
    expect(
      await screen.findByPlaceholderText(/create new list/i)
    ).toBeInTheDocument();
  });

  it('create new list input is hidden when the user has reached the 3-list cap', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => THREE_LISTS,
    });
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <SaveToListSheet
          shopId={SHOP_ID_1}
          open={true}
          onOpenChange={vi.fn()}
        />
      </SWRConfig>
    );
    // Wait for lists to load, then verify cap hides the create input
    await screen.findByRole('checkbox', { name: /work spots/i });
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText(/create new list/i)
      ).not.toBeInTheDocument();
    });
  });
});
