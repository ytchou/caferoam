import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StampDetailSheet } from './stamp-detail-sheet';

describe('StampDetailSheet', () => {
  const stamp = {
    id: 'stamp-1',
    user_id: 'user-123',
    shop_id: 'shop-a',
    check_in_id: 'ci-1',
    design_url: '/stamps/shop-a.svg',
    earned_at: '2026-03-01T10:30:00Z',
    shop_name: 'Fika Coffee',
  };

  it('renders shop name and earned date when mounted', () => {
    render(<StampDetailSheet stamp={stamp} onClose={vi.fn()} />);
    expect(screen.getByText('Fika Coffee')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('renders a link to the shop page', () => {
    render(<StampDetailSheet stamp={stamp} onClose={vi.fn()} />);
    const link = screen.getByRole('link', { name: /visit again/i });
    expect(link).toHaveAttribute('href', '/shop/shop-a');
  });

  it('stamp details disappear when the sheet is dismissed', () => {
    const { unmount } = render(
      <StampDetailSheet stamp={stamp} onClose={vi.fn()} />
    );
    unmount();
    expect(screen.queryByText('Fika Coffee')).not.toBeInTheDocument();
  });
});
