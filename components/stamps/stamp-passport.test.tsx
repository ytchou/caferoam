import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { makeStamp } from '@/lib/test-utils/factories';

import { StampPassport } from './stamp-passport';

describe('StampPassport', () => {
  it('renders 20 empty slots when no stamps exist', () => {
    render(<StampPassport stamps={[]} />);
    const emptySlots = screen.getAllByTestId('stamp-slot-empty');
    expect(emptySlots).toHaveLength(20);
  });

  it('renders stamps in filled slots and the rest as empty', () => {
    const stamps = [
      makeStamp({ id: 'stamp-1', shop_id: 'shop-a', design_url: '/stamps/shop-a.svg' }),
      makeStamp({ id: 'stamp-2', shop_id: 'shop-b', design_url: '/stamps/shop-b.svg' }),
    ];
    render(<StampPassport stamps={stamps} />);
    const filledSlots = screen.getAllByTestId('stamp-slot-filled');
    expect(filledSlots).toHaveLength(2);
    const emptySlots = screen.getAllByTestId('stamp-slot-empty');
    expect(emptySlots).toHaveLength(18);
  });

  it('shows page indicator dots when stamps exceed one page', () => {
    const stamps = Array.from({ length: 22 }, (_, i) =>
      makeStamp({
        id: `stamp-${i}`,
        shop_id: `shop-${i}`,
        design_url: `/stamps/shop-${i}.svg`,
      })
    );
    render(<StampPassport stamps={stamps} />);
    const dots = screen.getAllByTestId('page-dot');
    expect(dots).toHaveLength(2);
  });

  it('shows the total stamp count in the header', () => {
    const stamps = [makeStamp(), makeStamp({ id: 'stamp-2', shop_id: 'shop-b' })];
    render(<StampPassport stamps={stamps} />);
    expect(screen.getByText(/2 stamps/i)).toBeInTheDocument();
  });

  it('shows singular "stamp" for count of 1', () => {
    render(<StampPassport stamps={[makeStamp()]} />);
    expect(screen.getByText(/1 stamp/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 stamps/i)).not.toBeInTheDocument();
  });
});
