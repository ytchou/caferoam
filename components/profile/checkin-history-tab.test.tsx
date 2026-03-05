import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CheckinHistoryTab } from './checkin-history-tab';
import type { CheckInData } from '@/lib/hooks/use-user-checkins';

describe('CheckinHistoryTab', () => {
  const checkins: CheckInData[] = [
    {
      id: 'ci-1',
      user_id: 'user-123',
      shop_id: 'shop-a',
      shop_name: 'Fika Coffee',
      shop_mrt: 'Daan',
      photo_urls: ['https://example.com/photo1.jpg'],
      stars: 4,
      review_text: null,
      created_at: '2026-02-15T10:00:00Z',
    },
    {
      id: 'ci-2',
      user_id: 'user-123',
      shop_id: 'shop-b',
      shop_name: 'Rufous Coffee',
      shop_mrt: null,
      photo_urls: ['https://example.com/photo2.jpg'],
      stars: null,
      review_text: null,
      created_at: '2026-01-20T10:00:00Z',
    },
  ];

  it('renders check-in cards with shop names', () => {
    render(<CheckinHistoryTab checkins={checkins} isLoading={false} />);
    expect(screen.getByText('Fika Coffee')).toBeInTheDocument();
    expect(screen.getByText('Rufous Coffee')).toBeInTheDocument();
  });

  it('shows star rating when present', () => {
    render(<CheckinHistoryTab checkins={checkins} isLoading={false} />);
    // Fika has 4 stars
    const stars = screen.getAllByTestId('star-filled');
    expect(stars.length).toBeGreaterThanOrEqual(4);
  });

  it('shows MRT station as neighborhood', () => {
    render(<CheckinHistoryTab checkins={checkins} isLoading={false} />);
    expect(screen.getByText('Daan')).toBeInTheDocument();
  });

  it('renders empty state when no check-ins', () => {
    render(<CheckinHistoryTab checkins={[]} isLoading={false} />);
    expect(screen.getByText(/no check-ins yet/i)).toBeInTheDocument();
  });

  it('shows loading spinner', () => {
    render(<CheckinHistoryTab checkins={[]} isLoading={true} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('links shop names to shop pages', () => {
    render(<CheckinHistoryTab checkins={checkins} isLoading={false} />);
    const link = screen.getByRole('link', { name: 'Fika Coffee' });
    expect(link).toHaveAttribute('href', '/shop/shop-a');
  });
});
