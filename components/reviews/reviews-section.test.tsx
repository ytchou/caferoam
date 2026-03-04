import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

// Mock at the auth SDK boundary (Supabase session)
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  }),
}));

// Mock at the HTTP boundary
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { ReviewsSection } from './reviews-section';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
  );
}

describe('ReviewsSection', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('renders average rating and review count when authenticated', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        reviews: [
          {
            id: 'ci-1',
            user_id: 'user-chen-wei',
            display_name: 'Alice',
            stars: 4,
            review_text: 'Great latte!',
            confirmed_tags: ['quiet'],
            reviewed_at: '2026-03-04T10:00:00Z',
          },
        ],
        total_count: 1,
        average_rating: 4.5,
      }),
    });

    render(
      <Wrapper>
        <ReviewsSection shopId="shop-1" isAuthenticated={true} />
      </Wrapper>
    );
    expect(await screen.findByText(/4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/1 review/i)).toBeInTheDocument();
    expect(screen.getByText(/Great latte!/)).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it('does not render when not authenticated', () => {
    render(
      <Wrapper>
        <ReviewsSection shopId="shop-1" isAuthenticated={false} />
      </Wrapper>
    );
    expect(screen.queryByText(/User Reviews/)).not.toBeInTheDocument();
  });

  it('does not render when there are no reviews', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        reviews: [],
        total_count: 0,
        average_rating: 0,
      }),
    });

    render(
      <Wrapper>
        <ReviewsSection shopId="shop-2" isAuthenticated={true} />
      </Wrapper>
    );
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(screen.queryByText(/User Reviews/)).not.toBeInTheDocument();
  });
});
