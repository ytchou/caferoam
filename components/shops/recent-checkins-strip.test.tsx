import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const { mockUseUser } = vi.hoisted(() => ({
  mockUseUser: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user', () => ({
  useUser: mockUseUser,
}));

import { RecentCheckinsStrip } from './recent-checkins-strip';

const PREVIEW = { count: 12, previewPhotoUrl: 'https://example.com/preview.jpg' };
const CHECKINS = [
  { id: 'c1', displayName: 'Alice', photoUrl: 'https://example.com/c1.jpg', createdAt: '2026-03-10' },
  { id: 'c2', displayName: 'Bob', photoUrl: 'https://example.com/c2.jpg', createdAt: '2026-03-09' },
];

describe('RecentCheckinsStrip', () => {
  it('an unauthenticated visitor sees check-in count and one preview photo', () => {
    mockUseUser.mockReturnValue({ user: null });
    render(<RecentCheckinsStrip preview={PREVIEW} checkins={[]} />);
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  it('an authenticated user sees individual check-in photos with usernames', () => {
    mockUseUser.mockReturnValue({ user: { id: 'u1' } });
    render(<RecentCheckinsStrip preview={PREVIEW} checkins={CHECKINS} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does not render when count is zero', () => {
    mockUseUser.mockReturnValue({ user: null });
    const { container } = render(
      <RecentCheckinsStrip preview={{ count: 0, previewPhotoUrl: null }} checkins={[]} />
    );
    expect(container.firstChild).toBeNull();
  });
});
