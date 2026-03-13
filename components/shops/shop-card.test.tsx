import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ShopCard } from './shop-card';
import { makeShop } from '@/lib/test-utils/factories';

describe('ShopCard', () => {
  const shop = makeShop({ slug: 'shan-xiao-hai-ka-fei', rating: 4.6 });

  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders shop name', () => {
    render(<ShopCard shop={shop} />);
    expect(screen.getByText(shop.name)).toBeInTheDocument();
  });

  it('renders star rating', () => {
    render(<ShopCard shop={shop} />);
    expect(screen.getByText(/4\.6/)).toBeInTheDocument();
  });

  it('navigates to shop detail on click', async () => {
    render(<ShopCard shop={shop} />);
    await userEvent.click(screen.getByRole('article'));
    expect(mockPush).toHaveBeenCalledWith(
      `/shops/${shop.id}/shan-xiao-hai-ka-fei`
    );
  });
});
