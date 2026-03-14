import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const { mockGetUser, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockOnAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

import { RecentCheckinsStrip } from './recent-checkins-strip';

const PREVIEW = {
  count: 12,
  previewPhotoUrl: 'https://example.com/preview.jpg',
};
const CHECKINS = [
  {
    id: 'c1',
    displayName: 'Alice',
    photoUrl: 'https://example.com/c1.jpg',
    createdAt: '2026-03-10',
  },
  {
    id: 'c2',
    displayName: 'Bob',
    photoUrl: 'https://example.com/c2.jpg',
    createdAt: '2026-03-09',
  },
];

describe('RecentCheckinsStrip', () => {
  it('an unauthenticated visitor sees check-in count and one preview photo', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    render(<RecentCheckinsStrip preview={PREVIEW} checkins={[]} />);
    expect(await screen.findByText(/12/)).toBeInTheDocument();
  });

  it('an authenticated user sees individual check-in photos with usernames', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    render(<RecentCheckinsStrip preview={PREVIEW} checkins={CHECKINS} />);
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does not render when count is zero', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { container } = render(
      <RecentCheckinsStrip
        preview={{ count: 0, previewPhotoUrl: null }}
        checkins={[]}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
