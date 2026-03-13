import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MapMiniCard } from './map-mini-card';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('MapMiniCard', () => {
  const shop = {
    id: 'shop-abc123',
    name: '日光珈琲 Sunlight Coffee',
    slug: 'sunlight-coffee',
    rating: 4.7,
  };

  it('a visitor can see the shop name and rating on the map card', () => {
    render(<MapMiniCard shop={shop} onDismiss={vi.fn()} />);

    expect(screen.getByText('日光珈琲 Sunlight Coffee')).toBeInTheDocument();
    expect(screen.getByText('★ 4.7')).toBeInTheDocument();
  });

  it('a visitor clicking the dismiss button closes the card', async () => {
    const onDismiss = vi.fn();
    render(<MapMiniCard shop={shop} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: 'dismiss' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('a visitor clicking "查看詳情" navigates to the shop detail page', async () => {
    render(<MapMiniCard shop={shop} onDismiss={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '查看詳情' }));

    expect(mockPush).toHaveBeenCalledWith('/shops/shop-abc123/sunlight-coffee');
  });
});
