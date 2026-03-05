import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ListsTab } from './lists-tab';
import type { ListSummaryData } from '@/lib/hooks/use-list-summaries';

describe('ListsTab', () => {
  const lists: ListSummaryData[] = [
    {
      id: 'list-1',
      name: 'My Favourites',
      shop_count: 8,
      preview_photos: [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
        'https://example.com/photo3.jpg',
      ],
    },
    {
      id: 'list-2',
      name: 'Specialty Only',
      shop_count: 3,
      preview_photos: ['https://example.com/photo4.jpg'],
    },
  ];

  it('renders list cards with names and shop counts', () => {
    render(<ListsTab lists={lists} isLoading={false} />);
    expect(screen.getByText('My Favourites')).toBeInTheDocument();
    expect(screen.getByText(/8 shops/)).toBeInTheDocument();
    expect(screen.getByText('Specialty Only')).toBeInTheDocument();
    expect(screen.getByText(/3 shops/)).toBeInTheDocument();
  });

  it('renders preview photo thumbnails', () => {
    render(<ListsTab lists={lists} isLoading={false} />);
    const images = screen.getAllByRole('img');
    expect(images.length).toBe(4); // 3 from list-1, 1 from list-2
  });

  it('shows +N badge when more than 3 shops', () => {
    render(<ListsTab lists={lists} isLoading={false} />);
    expect(screen.getByText('+5')).toBeInTheDocument(); // 8 - 3 = 5
  });

  it('links cards to list pages', () => {
    render(<ListsTab lists={lists} isLoading={false} />);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/lists/list-1');
  });

  it('renders empty state when no lists', () => {
    render(<ListsTab lists={[]} isLoading={false} />);
    expect(screen.getByText(/no lists yet/i)).toBeInTheDocument();
  });

  it('shows loading spinner', () => {
    render(<ListsTab lists={[]} isLoading={true} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
