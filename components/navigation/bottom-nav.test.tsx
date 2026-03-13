import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomNav } from './bottom-nav';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('BottomNav', () => {
  it('renders four navigation tabs', () => {
    render(<BottomNav />);
    expect(screen.getByText('首頁')).toBeInTheDocument();
    expect(screen.getByText('地圖')).toBeInTheDocument();
    expect(screen.getByText('收藏')).toBeInTheDocument();
    expect(screen.getByText('我的')).toBeInTheDocument();
  });

  it('highlights the active tab based on current pathname', () => {
    render(<BottomNav />);
    // pathname is "/" so 首頁 should be active
    const homeLink = screen.getByText('首頁').closest('a');
    expect(homeLink).toHaveAttribute('data-active', 'true');
  });

  it('tab links navigate to correct routes', () => {
    render(<BottomNav />);
    expect(screen.getByText('地圖').closest('a')).toHaveAttribute(
      'href',
      '/map'
    );
    expect(screen.getByText('收藏').closest('a')).toHaveAttribute(
      'href',
      '/lists'
    );
    expect(screen.getByText('我的').closest('a')).toHaveAttribute(
      'href',
      '/profile'
    );
  });
});
