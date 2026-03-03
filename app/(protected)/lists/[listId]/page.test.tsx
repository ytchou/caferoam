import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useParams: () => ({ listId: 'l1' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-user-lists', () => ({
  useUserLists: () => ({
    lists: [
      { id: 'l1', name: 'Work spots', items: [{ shop_id: 's1' }, { shop_id: 's2' }] },
    ],
    isLoading: false,
    removeShop: vi.fn(),
    deleteList: vi.fn(),
    renameList: vi.fn(),
    isSaved: vi.fn(),
    isInList: vi.fn(),
    saveShop: vi.fn(),
    createList: vi.fn(),
    error: null,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      }),
    },
  }),
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [
    {
      id: 's1',
      name: '山小孩咖啡',
      address: '台北市大安區溫州街74巷',
      latitude: 25.0216,
      longitude: 121.5312,
      rating: 4.6,
      review_count: 287,
      photo_urls: [],
      taxonomy_tags: [],
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 's2',
      name: 'Simple Kaffa',
      address: '台北市中山區赤峰街1號',
      latitude: 25.0528,
      longitude: 121.5201,
      rating: 4.5,
      review_count: 512,
      photo_urls: [],
      taxonomy_tags: [],
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ],
});

import ListDetailPage from './page';

describe('/lists/[listId] page', () => {
  it('renders the list name in the header', async () => {
    render(<ListDetailPage />);
    expect(await screen.findByText('Work spots')).toBeInTheDocument();
  });

  it('renders shop cards from the list', async () => {
    render(<ListDetailPage />);
    expect(await screen.findByText('山小孩咖啡')).toBeInTheDocument();
    expect(await screen.findByText('Simple Kaffa')).toBeInTheDocument();
  });

  it('shows empty state when list has no shops', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    render(<ListDetailPage />);
    expect(await screen.findByText(/no shops saved yet/i)).toBeInTheDocument();
  });
});
