import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCapture = vi.fn();
vi.mock('@/lib/posthog/use-analytics', () => ({
  useAnalytics: () => ({ capture: mockCapture }),
}));

import { ShareButton } from './share-button';

describe('ShareButton', () => {
  const props = {
    shopId: 'shop-001',
    shopName: '山小孩咖啡',
    shareUrl: 'https://caferoam.tw/shops/shop-001/shan-xiao-hai-ka-fei',
  };

  beforeEach(() => {
    mockCapture.mockClear();
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders share button', () => {
    render(<ShareButton {...props} />);
    expect(screen.getByRole('button', { name: /分享/i })).toBeInTheDocument();
  });

  it('copies shop URL to clipboard when navigator.share is unavailable', async () => {
    render(<ShareButton {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /分享/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(props.shareUrl);
  });

  it('fires shop_url_copied analytics event on click', async () => {
    render(<ShareButton {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /分享/i }));
    expect(mockCapture).toHaveBeenCalledWith(
      'shop_url_copied',
      expect.objectContaining({ shop_id: props.shopId })
    );
  });
});
