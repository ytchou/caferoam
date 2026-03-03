import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock next/link to render as a regular anchor
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

import { ListCard } from './list-card';

describe('ListCard', () => {
  const defaultProps = {
    id: 'e3b0c442-98a1-441d-b22f-5a00bd8c3e1b',
    name: 'Work spots',
    itemCount: 12,
    onRename: vi.fn(),
    onDelete: vi.fn(),
  };

  it('a list card shows the list name and saved shop count', () => {
    render(<ListCard {...defaultProps} />);
    expect(screen.getByText('Work spots')).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  it('a list card has a menu button for rename and delete actions', () => {
    render(<ListCard {...defaultProps} />);
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });
});
