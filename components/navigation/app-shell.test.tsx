import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-media-query', () => ({
  useIsDesktop: vi.fn(),
}));

vi.mock('./bottom-nav', () => ({
  BottomNav: () => <nav data-testid="bottom-nav" />,
}));

vi.mock('./header-nav', () => ({
  HeaderNav: () => <header data-testid="header-nav" />,
}));

import { useIsDesktop } from '@/lib/hooks/use-media-query';

describe('AppShell', () => {
  it('on mobile, renders BottomNav but not HeaderNav', () => {
    vi.mocked(useIsDesktop).mockReturnValue(false);

    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>
    );

    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
    expect(screen.queryByTestId('header-nav')).not.toBeInTheDocument();
  });

  it('on desktop, renders HeaderNav but not BottomNav', () => {
    vi.mocked(useIsDesktop).mockReturnValue(true);

    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>
    );

    expect(screen.getByTestId('header-nav')).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument();
  });
});
