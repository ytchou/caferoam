import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { MapDesktopCard } from './map-desktop-card';

const SHOP = {
  id: 'shop-001',
  name: '山小孩咖啡',
  slug: 'shan-xiao-hai-ka-fei',
  rating: 4.6,
  mrt: '大安站',
  photoUrls: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg'],
  taxonomyTags: [
    {
      id: 'quiet',
      dimension: 'ambience' as const,
      label: 'Quiet',
      labelZh: '安靜',
    },
    {
      id: 'wifi',
      dimension: 'functionality' as const,
      label: 'Wi-Fi',
      labelZh: '有 Wi-Fi',
    },
  ],
};

describe('MapDesktopCard', () => {
  it('a user sees the shop name and neighborhood when a pin is selected', () => {
    render(<MapDesktopCard shop={SHOP} />);
    expect(screen.getByText('山小孩咖啡')).toBeInTheDocument();
    expect(screen.getByText('大安站')).toBeInTheDocument();
  });

  it('a user sees the star rating of the selected shop', () => {
    render(<MapDesktopCard shop={SHOP} />);
    expect(screen.getByText(/4\.6/)).toBeInTheDocument();
  });

  it('a user sees attribute chips for the selected shop', () => {
    render(<MapDesktopCard shop={SHOP} />);
    expect(screen.getByText('安靜')).toBeInTheDocument();
    expect(screen.getByText('有 Wi-Fi')).toBeInTheDocument();
  });

  it('a user can click View Details to navigate to the shop page', async () => {
    render(<MapDesktopCard shop={SHOP} />);
    await userEvent.click(
      screen.getByRole('button', { name: /查看詳情|View Details/i })
    );
    expect(mockPush).toHaveBeenCalledWith(
      '/shops/shop-001/shan-xiao-hai-ka-fei'
    );
  });

  it('a user can click Check In to navigate to the check-in page', async () => {
    render(<MapDesktopCard shop={SHOP} />);
    await userEvent.click(
      screen.getByRole('button', { name: /打卡|Check In/i })
    );
    expect(mockPush).toHaveBeenCalledWith('/checkin/shop-001');
  });
});
