import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockLists = [
  { id: 'l1', name: 'Work spots', items: [{ shop_id: 's1' }, { shop_id: 's2' }], created_at: '2026-01-15', updated_at: '2026-01-15' },
  { id: 'l2', name: 'Date night', items: [{ shop_id: 's3' }], created_at: '2026-01-16', updated_at: '2026-01-16' },
  { id: 'l3', name: 'Weekend', items: [], created_at: '2026-01-17', updated_at: '2026-01-17' },
];

vi.mock('@/lib/hooks/use-user-lists', () => ({
  useUserLists: () => ({
    lists: mockLists,
    isLoading: false,
    error: null,
    isSaved: vi.fn(),
    isInList: vi.fn(),
    saveShop: vi.fn(),
    removeShop: vi.fn(),
    createList: vi.fn(),
    deleteList: vi.fn(),
    renameList: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

import ListsPage from './page';

describe('/lists page', () => {
  it('renders list cards', () => {
    render(<ListsPage />);
    expect(screen.getByText('Work spots')).toBeInTheDocument();
    expect(screen.getByText('Date night')).toBeInTheDocument();
    expect(screen.getByText('Weekend')).toBeInTheDocument();
  });

  it('shows 3/3 cap indicator when at limit', () => {
    render(<ListsPage />);
    expect(screen.getByText(/3.*\/.*3|3\s*\/\s*3/)).toBeInTheDocument();
  });

  it('hides create input when at 3 lists', () => {
    render(<ListsPage />);
    expect(screen.queryByPlaceholderText(/create new list/i)).not.toBeInTheDocument();
  });
});
